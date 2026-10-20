import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type StripeEvent = {
  id?: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

function parseStripeSignature(signatureHeader: string) {
  const items = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = items.find((item) => item.startsWith("t="))?.slice(2);
  const signatures = items.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  return { timestamp, signatures };
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    const provided = Buffer.from(sig, "hex");
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });
}

function normalizeStatus(rawStatus: string | undefined) {
  if (!rawStatus) return "incomplete";
  if (rawStatus === "active" || rawStatus === "trialing") return "active";
  return rawStatus;
}

function parseWorkspaceId(input: unknown) {
  const value = Number(input);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is required" }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const eventId = (event.id || "").trim();
  if (!eventId) return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO billing_webhook_events(provider, event_key, event_type, received_at)
       VALUES('stripe', $1, $2, now())
       ON CONFLICT(provider, event_key) DO NOTHING
       RETURNING id`,
      [eventId, event.type]
    );

    if ((inserted.rowCount ?? 0) === 0) {
      // A previously failed delivery is deliberately retryable. Only an event
      // with processed_at set is considered permanently handled.
      const existing = await client.query<{ processed_at: Date | null }>(
        `SELECT processed_at
         FROM billing_webhook_events
         WHERE provider='stripe' AND event_key=$1
         FOR UPDATE`,
        [eventId]
      );

      if (existing.rows[0]?.processed_at) {
        await client.query("ROLLBACK");
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    const object = (event.data?.object ?? {}) as Record<string, unknown>;

    if (event.type === "checkout.session.completed") {
      const metadata = (object.metadata ?? {}) as Record<string, unknown>;
      const workspaceId = parseWorkspaceId(metadata.workspace_id ?? object.client_reference_id);
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;

      if (workspaceId) {
        await client.query(
          `INSERT INTO workspace_subscriptions(workspace_id, provider, provider_subscription_id, status, updated_at)
           VALUES($1, 'stripe', $2, 'active', now())
           ON CONFLICT(workspace_id) DO UPDATE SET
             provider='stripe',
             provider_subscription_id=EXCLUDED.provider_subscription_id,
             status='active',
             updated_at=now()`,
          [workspaceId, subscriptionId]
        );
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscriptionId = typeof object.id === "string" ? object.id : "";
      const status = normalizeStatus(typeof object.status === "string" ? object.status : undefined);

      if (subscriptionId) {
        const updated = await client.query(
          "UPDATE workspace_subscriptions SET status=$1, updated_at=now() WHERE provider_subscription_id=$2",
          [status, subscriptionId]
        );

        if ((updated.rowCount ?? 0) === 0) {
          const metadata = (object.metadata ?? {}) as Record<string, unknown>;
          const workspaceId = parseWorkspaceId(metadata.workspace_id);
          if (workspaceId) {
            await client.query(
              `INSERT INTO workspace_subscriptions(workspace_id, provider, provider_subscription_id, status, updated_at)
               VALUES($1, 'stripe', $2, $3, now())
               ON CONFLICT(workspace_id) DO UPDATE SET
                 provider='stripe',
                 provider_subscription_id=EXCLUDED.provider_subscription_id,
                 status=EXCLUDED.status,
                 updated_at=now()`,
              [workspaceId, subscriptionId, status]
            );
          }
        }
      }
    }

    await client.query(
      "UPDATE billing_webhook_events SET processed_at=now(), processing_error=NULL WHERE provider='stripe' AND event_key=$1",
      [eventId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ received: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // Keep failed events retryable. Do not mark processed_at here; if another
    // delivery succeeds concurrently, its processed_at must remain authoritative.
    await db.query(
      `UPDATE billing_webhook_events
       SET processing_error=$2
       WHERE provider='stripe' AND event_key=$1 AND processed_at IS NULL`,
      [eventId, error instanceof Error ? error.message : "unknown error"]
    ).catch(() => {});

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
