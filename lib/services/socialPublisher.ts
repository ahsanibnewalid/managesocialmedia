import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type Platform = "facebook" | "instagram" | "linkedin" | "x" | "tiktok";
export type PublishInput = { platform: Platform; text: string; mediaUrl?: string | null; externalAccountId: string; encryptedToken: string; onTokenRefresh?: (ciphertext: string, expiresAt?: Date) => Promise<void> };
type TokenBundle = { accessToken: string; refreshToken?: string; expiresAt?: number };
type PublishResult = { externalPostId: string; platform: Platform; refreshedEncryptedToken?: string; tokenExpiresAt?: Date };

function encryptionKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}
function encryptToken(token: TokenBundle): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),encrypted.toString("base64")].join(":");
}
/** Token ciphertext format: v1:<base64 iv>:<base64 auth tag>:<base64 ciphertext>. */
function decryptToken(ciphertext: string): TokenBundle {
  const [version, ivText, tagText, dataText] = ciphertext.split(":");
  if (version !== "v1" || !ivText || !tagText || !dataText) throw new Error("Unsupported encrypted token format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataText, "base64")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plaintext) as TokenBundle;
  if (!parsed.accessToken) throw new Error("Encrypted token bundle is missing accessToken");
  return parsed;
}
async function providerFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(`Provider API returned HTTP ${response.status}: ${String(body?.error?.message || body?.error_description || body?.message || "request rejected")}`);
  return body;
}
function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
async function refreshToken(platform: Platform, token: TokenBundle): Promise<TokenBundle> {
  if (!token.refreshToken) throw new Error(`The ${platform} access token expired and no refresh token is stored`);
  let url: string;
  let body: URLSearchParams;
  const headers: Record<string,string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (platform === "linkedin") {
    url = "https://www.linkedin.com/oauth/v2/accessToken";
    body = new URLSearchParams({ grant_type:"refresh_token", refresh_token:token.refreshToken, client_id:requiredEnv("LINKEDIN_CLIENT_ID"), client_secret:requiredEnv("LINKEDIN_CLIENT_SECRET") });
  } else if (platform === "x") {
    url = "https://api.x.com/2/oauth2/token";
    body = new URLSearchParams({ grant_type:"refresh_token", refresh_token:token.refreshToken, client_id:requiredEnv("X_CLIENT_ID") });
    headers.Authorization = "Basic " + Buffer.from(requiredEnv("X_CLIENT_ID") + ":" + requiredEnv("X_CLIENT_SECRET")).toString("base64");
  } else if (platform === "tiktok") {
    url = "https://open.tiktokapis.com/v2/oauth/token/";
    body = new URLSearchParams({ grant_type:"refresh_token", refresh_token:token.refreshToken, client_key:requiredEnv("TIKTOK_CLIENT_KEY"), client_secret:requiredEnv("TIKTOK_CLIENT_SECRET") });
  } else {
    throw new Error(`Automatic token refresh for ${platform} must be completed using the Meta app's approved token lifecycle`);
  }
  const result = await providerFetch(url, { method:"POST", headers, body });
  if (!result.access_token) throw new Error(`The ${platform} refresh response did not include an access token`);
  return { accessToken:result.access_token, refreshToken:result.refresh_token || token.refreshToken, expiresAt:result.expires_in ? Date.now() + Number(result.expires_in) * 1000 : undefined };
}
/** Posts only through provider APIs and returns refreshed credentials for encrypted persistence. */
export async function publishToSocialPlatform(input: PublishInput): Promise<PublishResult> {
  let token = decryptToken(input.encryptedToken);
  let refreshedEncryptedToken: string | undefined;
  if (token.expiresAt && token.expiresAt <= Date.now() + 60_000) {
    token = await refreshToken(input.platform, token);
    refreshedEncryptedToken = encryptToken(token);
    // Persist rotation before making the publish request so a failed publish does not lose a rotated refresh token.
    await input.onTokenRefresh?.(refreshedEncryptedToken, token.expiresAt ? new Date(token.expiresAt) : undefined);
  }
  let externalPostId = "";
  if (input.platform === "facebook") {
    const version = process.env.META_GRAPH_API_VERSION || "v23.0";
    const result = await providerFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(input.externalAccountId)}/feed`, {
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({ message:input.text, access_token:token.accessToken })
    });
    externalPostId = result.id;
  } else if (input.platform === "instagram") {
    if (!input.mediaUrl || !input.mediaUrl.startsWith("https://")) throw new Error("Instagram publishing requires a publicly accessible HTTPS image URL");
    const version = process.env.META_GRAPH_API_VERSION || "v23.0";
    const container = await providerFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(input.externalAccountId)}/media`, {
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({ image_url:input.mediaUrl, caption:input.text, access_token:token.accessToken })
    });
    if (!container.id) throw new Error("Instagram API did not return a media container ID");
    const published = await providerFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(input.externalAccountId)}/media_publish`, {
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({ creation_id:container.id, access_token:token.accessToken })
    });
    externalPostId = published.id;
  } else if (input.platform === "linkedin") {
    const result = await providerFetch("https://api.linkedin.com/rest/posts", {
      method:"POST",
      headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":"application/json","X-Restli-Protocol-Version":"2.0","LinkedIn-Version":requiredEnv("LINKEDIN_API_VERSION")},
      body:JSON.stringify({ author:input.externalAccountId, commentary:input.text, visibility:"PUBLIC", distribution:{feedDistribution:"MAIN_FEED",targetEntities:[]}, lifecycleState:"PUBLISHED", isReshareDisabledByAuthor:false })
    });
    externalPostId = result.id || result.urn;
  } else if (input.platform === "x") {
    const result = await providerFetch("https://api.x.com/2/tweets", {
      method:"POST", headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":"application/json"},
      body:JSON.stringify({ text:input.text })
    });
    externalPostId = result.data?.id;
  } else if (input.platform === "tiktok") {
    throw new Error("TikTok publishing requires the approved video upload/publish workflow; text-only publishing is disabled");
  }
  if (!externalPostId) throw new Error(`The ${input.platform} API did not return a post ID`);
  return { platform:input.platform, externalPostId, refreshedEncryptedToken, tokenExpiresAt:token.expiresAt ? new Date(token.expiresAt) : undefined };
}
