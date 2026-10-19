import "server-only";
import { createHash } from "node:crypto";
import { encryptSocialToken, type SocialTokenBundle } from "@/lib/social-token-vault";

export type OAuthPlatform = "facebook" | "instagram" | "linkedin" | "x" | "tiktok";
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string; error?: string; error_description?: string };
type AccountIdentity = { externalId: string; accountName: string; token: SocialTokenBundle };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for this provider`);
  return value;
}
function appUrl(): string {
  const url = env("APP_URL");
  if (!/^https?:\/\//i.test(url)) throw new Error("APP_URL must be an absolute HTTP(S) URL");
  return url.replace(/\/$/, "");
}
export function callbackUrl(): string { return `${appUrl()}/api/social/callback`; }
export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function metaVersion(): string {
  const version = env("META_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_API_VERSION must look like vNN.N");
  return version;
}
export function createAuthorizationUrl(platform: OAuthPlatform, state: string, challenge: string): string {
  const redirectUri = callbackUrl();
  const common = { state, redirect_uri: redirectUri, response_type: "code" };
  let url: URL;
  if (platform === "facebook" || platform === "instagram") {
    url = new URL(`https://www.facebook.com/${metaVersion()}/dialog/oauth`);
    url.search = new URLSearchParams({ ...common, client_id: env("META_APP_ID"), scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights" }).toString();
  } else if (platform === "linkedin") {
    url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.search = new URLSearchParams({ ...common, client_id: env("LINKEDIN_CLIENT_ID"), scope: "openid profile w_member_social r_organization_social rw_organization_admin" }).toString();
  } else if (platform === "x") {
    url = new URL("https://x.com/i/oauth2/authorize");
    url.search = new URLSearchParams({ ...common, client_id: env("X_CLIENT_ID"), code_challenge: challenge, code_challenge_method: "S256", scope: "tweet.read tweet.write users.read offline.access" }).toString();
  } else {
    url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.search = new URLSearchParams({ ...common, client_key: env("TIKTOK_CLIENT_KEY"), code_challenge: challenge, code_challenge_method: "S256", scope: "user.info.basic,video.publish,video.list" }).toString();
  }
  return url.toString();
}

async function requestJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* provider returned non-JSON */ }
  if (!response.ok || data.error || data.error_description) {
    const message = typeof data.error === "string" ? data.error : data.error?.message || data.error_description || `HTTP ${response.status}`;
    throw new Error(`OAuth provider rejected the request: ${String(message).slice(0, 300)}`);
  }
  return data;
}
async function exchangeCode(platform: OAuthPlatform, code: string, verifier: string): Promise<SocialTokenBundle> {
  let url: string;
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl() });
  const headers: Record<string,string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (platform === "facebook" || platform === "instagram") {
    url = `https://graph.facebook.com/${metaVersion()}/oauth/access_token`;
    body.set("client_id", env("META_APP_ID")); body.set("client_secret", env("META_APP_SECRET"));
  } else if (platform === "linkedin") {
    url = "https://www.linkedin.com/oauth/v2/accessToken";
    body.set("client_id", env("LINKEDIN_CLIENT_ID")); body.set("client_secret", env("LINKEDIN_CLIENT_SECRET"));
  } else if (platform === "x") {
    url = "https://api.x.com/2/oauth2/token";
    body.set("client_id", env("X_CLIENT_ID")); body.set("code_verifier", verifier);
    headers.Authorization = "Basic " + Buffer.from(env("X_CLIENT_ID") + ":" + env("X_CLIENT_SECRET")).toString("base64");
  } else {
    url = "https://open.tiktokapis.com/v2/oauth/token/";
    body.set("client_key", env("TIKTOK_CLIENT_KEY")); body.set("client_secret", env("TIKTOK_CLIENT_SECRET")); body.set("code_verifier", verifier);
  }
  const result = await requestJson(url, { method: "POST", headers, body }) as TokenResponse;
  if (!result.access_token) throw new Error("Provider token exchange returned no access token");
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token || undefined,
    expiresAt: result.expires_in ? Date.now() + Number(result.expires_in) * 1000 : undefined,
    tokenType: result.token_type || "Bearer",
    scope: result.scope
  };
}

export async function resolveConnectedAccount(platform: OAuthPlatform, code: string, verifier: string): Promise<AccountIdentity> {
  const token = await exchangeCode(platform, code, verifier);
  if (platform === "facebook" || platform === "instagram") {
    const version = metaVersion();
    const pages = await requestJson(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token.accessToken)}`, { method: "GET" });
    const items = Array.isArray(pages.data) ? pages.data : [];
    const page = platform === "instagram" ? items.find((item: any) => item.instagram_business_account?.id) : items[0];
    if (!page?.id || !page.access_token) throw new Error(platform === "instagram" ? "No Instagram professional account linked to a Facebook Page was found. Link an Instagram professional account to a Page and retry." : "No Facebook Page was returned for this user.");
    const selectedToken: SocialTokenBundle = { ...token, accessToken: page.access_token };
    if (platform === "instagram") {
      return { externalId: String(page.instagram_business_account.id), accountName: String(page.instagram_business_account.username || page.name || "Instagram account"), token: selectedToken };
    }
    return { externalId: String(page.id), accountName: String(page.name || "Facebook Page"), token: selectedToken };
  }
  if (platform === "linkedin") {
    const profile = await requestJson("https://api.linkedin.com/v2/userinfo", { method: "GET", headers: { Authorization: `Bearer ${token.accessToken}` } });
    if (!profile.sub) throw new Error("LinkedIn user profile did not return an account ID");
    return { externalId: `urn:li:person:${profile.sub}`, accountName: String(profile.name || profile.email || "LinkedIn member"), token };
  }
  if (platform === "x") {
    const profile = await requestJson("https://api.x.com/2/users/me?user.fields=name,username", { method: "GET", headers: { Authorization: `Bearer ${token.accessToken}` } });
    const user = profile.data;
    if (!user?.id) throw new Error("X user profile did not return an account ID");
    return { externalId: String(user.id), accountName: `@${user.username || user.name || user.id}`, token };
  }
  const profile = await requestJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { method: "GET", headers: { Authorization: `Bearer ${token.accessToken}` } });
  const user = profile.data?.user;
  if (!user?.open_id) throw new Error("TikTok user profile did not return an account ID");
  return { externalId: String(user.open_id), accountName: String(user.display_name || "TikTok account"), token };
}

export async function revokeProviderToken(platform: OAuthPlatform, accessToken: string): Promise<void> {
  // Revocation is best-effort because provider capabilities differ by app type.
  try {
    if (platform === "x") {
      const body = new URLSearchParams({ token: accessToken, token_type_hint: "access_token", client_id: env("X_CLIENT_ID") });
      await requestJson("https://api.x.com/2/oauth2/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(env("X_CLIENT_ID") + ":" + env("X_CLIENT_SECRET")).toString("base64") }, body });
    } else if (platform === "tiktok") {
      await requestJson("https://open.tiktokapis.com/v2/oauth/revoke/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), token: accessToken }) });
    } else if (platform === "facebook" || platform === "instagram") {
      await requestJson(`https://graph.facebook.com/${metaVersion()}/me/permissions?access_token=${encodeURIComponent(accessToken)}`, { method: "DELETE" });
    } else {
      // LinkedIn's app/API support for programmatic revocation varies; disconnect is still enforced locally.
    }
  } catch (error) {
    console.warn("Provider token revocation was not confirmed; local access was disabled.", error instanceof Error ? error.message : "unknown error");
  }
}

export async function encryptedTokenFor(identity: AccountIdentity): Promise<string> {
  const { encryptSocialToken } = await import("@/lib/social-token-vault");
  return encryptSocialToken(identity.token);
}
