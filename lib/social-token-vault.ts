import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SocialTokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
};

function key(): Buffer {
  const encoded = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes");
  }
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== encoded) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes");
  }
  return decoded;
}

export function encryptSocialToken(token: SocialTokenBundle): string {
  if (!token.accessToken) throw new Error("Refusing to encrypt an empty access token");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSocialToken(value: string): SocialTokenBundle {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported encrypted token format");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  if (
    iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0 ||
    iv.toString("base64") !== parts[1] ||
    tag.toString("base64") !== parts[2] ||
    ciphertext.toString("base64") !== parts[3]
  ) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Encrypted token bundle is malformed");
  const token = parsed as Partial<SocialTokenBundle>;
  if (typeof token.accessToken !== "string" || !token.accessToken) throw new Error("Encrypted token is missing accessToken");
  if (token.refreshToken !== undefined && typeof token.refreshToken !== "string") throw new Error("Encrypted token bundle is malformed");
  if (token.expiresAt !== undefined && (typeof token.expiresAt !== "number" || !Number.isFinite(token.expiresAt))) throw new Error("Encrypted token bundle is malformed");
  if (token.tokenType !== undefined && typeof token.tokenType !== "string") throw new Error("Encrypted token bundle is malformed");
  if (token.scope !== undefined && typeof token.scope !== "string") throw new Error("Encrypted token bundle is malformed");
  return token as SocialTokenBundle;
}
