import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireWorkspaceRole } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  workspaceId: z.coerce.number().int().positive().refine(Number.isSafeInteger),
  priceId: z.string().trim().min(1).max(255)
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "workspaceId and priceId are required" }, { status: 400 });
  }

  const { workspaceId, priceId } = parsed.data;
  const role = await requireWorkspaceRole(user.id, workspaceId, ["owner", "admin"]);
  if (!role) {
    return NextResponse.json({ error: "Workspace administrator access is required" }, { status: 403 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "STRIPE_SECRET_KEY is required" }, { status: 500 });

  const appOrigin = process.env.APP_URL || request.nextUrl.origin;
  const successUrl = `${appOrigin}/organization/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appOrigin}/organization/billing?checkout=cancelled`;

  const params = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(workspaceId)
  });

  params.append("line_items[0][price]", priceId);
  params.append("line_items[0][quantity]", "1");
  params.append("metadata[workspace_id]", String(workspaceId));

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const stripePayload = await stripeResponse.json().catch(() => null);
  if (!stripeResponse.ok || !stripePayload?.url) {
    return NextResponse.json({ error: stripePayload?.error?.message || "Failed to create checkout session" }, { status: 502 });
  }

  return NextResponse.json({ url: stripePayload.url });
}
