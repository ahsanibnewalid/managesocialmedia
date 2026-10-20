import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Credential encryption uses a dedicated 32-byte key supplied by deployment.
 * It is not a gateway credential and must never be stored in the database.
 * Generate with: openssl rand -base64 32
 */
function key(): Buffer {
  const raw = process.env.BILLING_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) {
    throw new Error("BILLING_CREDENTIALS_ENCRYPTION_KEY must be valid base64 for exactly 32 bytes");
  }
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32 || value.toString("base64") !== raw) {
    throw new Error("BILLING_CREDENTIALS_ENCRYPTION_KEY must be valid base64 for exactly 32 bytes");
  }
  return value;
}

function validateCredentialRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid encrypted billing credential record");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([name, secret]) => !name || typeof secret !== "string")) {
    throw new Error("Invalid encrypted billing credential record");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

export function encryptBillingCredentials(value: Record<string, string>) {
  const credentials = validateCredentialRecord(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptBillingCredentials(value: { ciphertext: string; iv: string; tag: string }): Record<string, string> {
  const iv = Buffer.from(value.iv, "base64");
  const tag = Buffer.from(value.tag, "base64");
  const ciphertext = Buffer.from(value.ciphertext, "base64");
  if (iv.length !== 12 || tag.length !== 16 || !value.ciphertext || ciphertext.toString("base64") !== value.ciphertext) {
    throw new Error("Invalid encrypted billing credential envelope");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    throw new Error("Invalid decrypted billing credential record");
  }
  return validateCredentialRecord(parsed);
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  return value.length < 6 ? "••••" : value.slice(0, 2) + "••••••" + value.slice(-3);
}
