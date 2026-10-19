import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSocialToken } from "@/lib/social-token-vault";
import { resolveConnectedAccount, type OAuthPlatform } from "@/lib/services/socialOAuth";

const allowed = new Set(["facebook", "instagram", "linkedin", "x", "tiktok"]);
export async function GET(request: NextRequest) {
  const base = new URL("/dashboard", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (error || !code || !state || state.length > 256) {
    base.searchParams.set("social", "cancelled");
    return NextResponse.redirect(base);
  }
  const stateHash = createHash("sha256").update(state).digest("hex");
  // DELETE ... RETURNING makes the OAuth state one-time-use even under concurrent callbacks.
  const claimed = await db.query(
    "DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at>now() RETURNING user_id,workspace_id,platform,code_verifier",
    [stateHash]
  );
  const oauth = claimed.rows[0];
  if (!oauth || !allowed.has(oauth.platform)) {
    base.searchParams.set("social", "invalid-state");
    return NextResponse.redirect(base);
  }
  try {
    const membership = await db.query("SELECT 1 FROM workspace_members WHERE user_id=$1 AND workspace_id=$2 AND role = ANY($3::text[])", [oauth.user_id, oauth.workspace_id, ["owner", "admin"]]);
    if (!membership.rowCount) throw new Error("Workspace access was revoked while OAuth was in progress");
    const platform = oauth.platform as OAuthPlatform;
    const identity = await resolveConnectedAccount(platform, code, oauth.code_verifier);
    const ciphertext = encryptSocialToken(identity.token);
    await db.query(
      `INSERT INTO social_accounts(workspace_id,platform,account_name,external_id,status,token_ciphertext,token_expires_at)
       VALUES($1,$2,$3,$4,'connected',$5,$6)
       ON CONFLICT (workspace_id,platform,external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET account_name=EXCLUDED.account_name,status='connected',token_ciphertext=EXCLUDED.token_ciphertext,
                     token_expires_at=EXCLUDED.token_expires_at`,
      [oauth.workspace_id, platform, identity.accountName, identity.externalId, ciphertext, identity.token.expiresAt ? new Date(identity.token.expiresAt) : null]
    );
    await db.query("INSERT INTO audit_log(user_id,workspace_id,action,metadata) VALUES($1,$2,'social.account_connected',$3)",
      [oauth.user_id, oauth.workspace_id, JSON.stringify({ platform, externalAccountId: identity.externalId })]);
    base.searchParams.set("social", "connected");
  } catch (cause) {
    console.error("Social OAuth callback failed", cause instanceof Error ? cause.message : "unknown error");
    base.searchParams.set("social", "failed");
  }
  return NextResponse.redirect(base);
}
