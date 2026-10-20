import "server-only";
import { db } from "@/lib/db";

export async function requireActiveSubscription(workspaceId: number) {
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) return false;

  const result = await db.query(
    "SELECT 1 FROM workspace_subscriptions WHERE workspace_id=$1 AND status='active' LIMIT 1",
    [workspaceId]
  );

  return (result.rowCount ?? 0) > 0;
}
