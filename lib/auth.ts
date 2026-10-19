import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";

export type SessionUser = { id: number; email: string; name: string };
const COOKIE_NAME = "tidepost_session";
export async function getSessionUser(): Promise<SessionUser | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret, { issuer: "tidepost" }) as jwt.JwtPayload;
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const result = await db.query("SELECT id, name, email FROM users WHERE id=$1", [id]);
    return result.rows[0] ?? null;
  } catch { return null; }
}
export { COOKIE_NAME };
export async function requireWorkspaceRole(userId: number, workspaceId: number, roles: string[]) {
  const result = await db.query(
    "SELECT role FROM workspace_members WHERE user_id=$1 AND workspace_id=$2",
    [userId, workspaceId]
  );
  const role = result.rows[0]?.role as string | undefined;
  return role && roles.includes(role) ? role : null;
}
