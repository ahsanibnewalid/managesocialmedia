import "server-only";
import { db } from "@/lib/db";

type AuditInput = {
  actorUserId?: number | null;
  actorIp?: string | null;
  workspaceId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function audit(input: AuditInput) {
  await db.query(
    `INSERT INTO audit_log(
      occurred_at, actor_user_id, actor_ip, workspace_id, action, target_type, target_id, metadata, user_id, created_at
    ) VALUES (
      now(), $1, $2::inet, $3, $4, $5, $6, $7::jsonb, $8, now()
    )`,
    [
      input.actorUserId ?? null,
      input.actorIp ?? null,
      input.workspaceId ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.actorUserId ?? null
    ]
  );
}
