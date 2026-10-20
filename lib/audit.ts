import "server-only";
import { db } from "@/lib/db";

// PostgreSQL BIGINT IDs are represented as numbers at the application boundary
// to match the existing users/workspaces/auth types. UUIDs are not used here.
type CoreId = number;

type AuditInput = {
  actorUserId?: CoreId | null;
  actorIp?: string | null;
  workspaceId?: CoreId | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeId(id: CoreId | null | undefined) {
  if (id == null) return null;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function audit(input: AuditInput) {
  const actorUserId = normalizeId(input.actorUserId);
  const workspaceId = normalizeId(input.workspaceId);

  await db.query(
    `INSERT INTO audit_log(
      occurred_at, actor_user_id, actor_ip, workspace_id, action, target_type, target_id, metadata, user_id, created_at
    ) VALUES (
      now(), $1, $2::inet, $3, $4, $5, $6, $7::jsonb, $8, now()
    )`,
    [
      actorUserId,
      input.actorIp ?? null,
      workspaceId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {}),
      actorUserId
    ]
  );
}
