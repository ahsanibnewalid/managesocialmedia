import "dotenv/config";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type AppliedMigration = { filename: string; checksum: string };

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable(pool: Pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
}

async function listUpMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql") && !name.endsWith(".down.sql")).sort();
}

async function applyUp(pool: Pool) {
  const upFiles = await listUpMigrations();

  for (const file of upFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = await fs.readFile(filePath, "utf8");
    const checksum = sha256(sql);
    const applied = await pool.query<AppliedMigration>("SELECT filename, checksum FROM schema_migrations WHERE filename=$1", [file]);

    if ((applied.rowCount ?? 0) > 0) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(`Checksum mismatch for already-applied migration: ${file}`);
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename, checksum) VALUES($1, $2)", [file, checksum]);
      await client.query("COMMIT");
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function applyDown(pool: Pool) {
  const latest = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY applied_at DESC, filename DESC LIMIT 1"
  );

  if ((latest.rowCount ?? 0) === 0) {
    console.info("No applied migrations to roll back.");
    return;
  }

  const file = latest.rows[0].filename;
  const downFile = file.replace(/\.sql$/, ".down.sql");
  const downPath = path.join(MIGRATIONS_DIR, downFile);
  const downSql = await fs.readFile(downPath, "utf8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(downSql);
    await client.query("DELETE FROM schema_migrations WHERE filename=$1", [file]);
    await client.query("COMMIT");
    console.info(`Rolled back migration ${file}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 5000
  });

  try {
    await ensureMigrationsTable(pool);
    if (process.argv.includes("--down")) await applyDown(pool);
    else await applyUp(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
