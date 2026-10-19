import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, requireWorkspaceRole } from "@/lib/auth";
import { decryptSocialToken } from "@/lib/social-token-vault";
import { revokeProviderToken, type OAuthPlatform } from "@/lib/services/socialOAuth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await context.params;
  const accountId = Number(id);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  const found = await db.query("SELECT id,workspace_id,platform,token_ciphertext FROM social_accounts WHERE id=$1", [accountId]);
  const account = found.rows[0];
  if (!account || !await requireWorkspaceRole(user.id, Number(account.workspace_id), ["owner", "admin"])) {
    return NextResponse.json({ error: "Account not found or forbidden" }, { status: 404 });
  }
  if (account.token_ciphertext) {
    try {
      const token = decryptSocialToken(account.token_ciphertext);
      await revokeProviderToken(account.platform as OAuthPlatform, token.accessToken);
    } catch (error) {
      console.warn("Could not confirm provider token revocation", error instanceof Error ? error.message : "unknown error");
    }
  }
  await db.query("UPDATE social_accounts SET status='disconnected',token_ciphertext=NULL,token_expires_at=NULL WHERE id=$1 AND workspace_id=$2", [accountId, account.workspace_id]);
  await db.query("INSERT INTO audit_log(user_id,workspace_id,action,metadata) VALUES($1,$2,'social.account_disconnected',$3)",
    [user.id, account.workspace_id, JSON.stringify({ platform: account.platform, accountId })]);
  return NextResponse.json({ ok: true, message: "Account disconnected locally; provider revocation is best-effort." });
}
