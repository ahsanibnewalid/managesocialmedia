import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Pool } from "pg";

function getKey(varName: string) {
  const value = process.env[varName];
  if (!value) throw new Error(`${varName} is required`);
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error(`${varName} must decode to exactly 32 bytes`);
  return decoded;
}

function decryptV1(ciphertextValue: string, key: Buffer) {
  const parts = ciphertextValue.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported encrypted token format");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptV1(plaintext: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const apply = process.argv.includes("--apply");
  const oldKey = getKey("SOCIAL_TOKEN_ENCRYPTION_KEY");
  const newKey = getKey("SOCIAL_TOKEN_ENCRYPTION_KEY_NEW");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 5000
  });

  const client = await pool.connect();
  let rotated = 0;
  try {
    if (apply) await client.query("BEGIN");

    const rows = await client.query<{ id: number; token_ciphertext: string }>(
      "SELECT id, token_ciphertext FROM social_accounts WHERE token_ciphertext IS NOT NULL"
    );

    for (const row of rows.rows) {
      const decrypted = decryptV1(row.token_ciphertext, oldKey);
      const reencrypted = encryptV1(decrypted, newKey);
      rotated += 1;

      if (apply) {
        await client.query("UPDATE social_accounts SET token_ciphertext=$1 WHERE id=$2", [reencrypted, row.id]);
      }
    }

    if (apply) {
      await client.query("COMMIT");
      console.info(`Applied token key rotation for ${rotated} rows.`);
    } else {
      console.info(`Dry run complete. ${rotated} rows would be updated.`);
      console.info("Run with --apply to persist changes.");
    }
  } catch (error) {
    if (apply) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Token key rotation failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
