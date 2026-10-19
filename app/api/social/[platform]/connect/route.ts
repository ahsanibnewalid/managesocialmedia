import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireWorkspaceRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuthorizationUrl, type OAuthPlatform } from "@/lib/services/socialOAuth";

const platforms = new Set(["facebook", "instagram", "linkedin", "x", "tiktok"]);
export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login?error=auth", request.url));
  const { platform: rawPlatform } = await context.params;
  if (!platforms.has(rawPlatform)) return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  const platform = rawPlatform as OAuthPlatform;
  const workspaceId = Number(request.nextUrl.searchParams.get("workspace"));
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0 || !await requireWorkspaceRole(user.id, workspaceId, ["owner", "admin"])) {
    return NextResponse.json({ error: "Workspace administrator access is required" }, { status: 403 });
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.query(
    "INSERT INTO oauth_states(state_hash,user_id,workspace_id,platform,code_verifier,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [createHash("sha256").update(state).digest("hex"), user.id, workspaceId, platform, verifier, expiresAt]
  );
  try {
    const target = createAuthorizationUrl(platform, state, challenge);
    return NextResponse.redirect(target);
  } catch (error) {
    await db.query("DELETE FROM oauth_states WHERE state_hash=$1", [createHash("sha256").update(state).digest("hex")]);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider OAuth is not configured" }, { status: 503 });
  }
}
