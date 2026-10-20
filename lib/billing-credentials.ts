import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Credential encryption uses a dedicated 32-byte key supplied by deployment.
 * It is not a gateway credential and must never be stored in the database.
 * Generate with: openssl rand -base64 32
 */
function key(): Buffer {
  const raw = process.env.BILLING_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("BILLING_CREDENTIALS_ENCRYPTION_KEY is not configured");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("BILLING_CREDENTIALS_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  return value;
}
export function encryptBillingCredentials(value: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
export function decryptBillingCredentials(value: { ciphertext: string; iv: string; tag: string }): Record<string, string> {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as Record<string, string>;
}
export function maskSecret(value?: string | null) {
  if (!value) return "";
  return value.length < 6 ? "••••" : value.slice(0, 2) + "••••••" + value.slice(-3);
}
