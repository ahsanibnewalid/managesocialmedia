require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000
});
const advisoryLockId = 72419351;

async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [advisoryLockId]);
    lockAcquired = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const directory = path.join(__dirname, "..", "db", "migrations");
    const files = fs.readdirSync(directory)
      .filter(file => /^[0-9]+_[a-z0-9_-]+\.sql$/.test(file))
      .sort();
    if (!files.length) throw new Error("No versioned SQL migrations found in db/migrations");

    for (const file of files) {
      const sql = fs.readFileSync(path.join(directory, file), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const existing = await client.query("SELECT checksum FROM schema_migrations WHERE version=$1", [file]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${file} has changed; add a new migration instead of editing it`);
        }
        console.info(`Skipping applied migration ${file}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)", [file, checksum]);
        await client.query("COMMIT");
        console.info(`Applied migration ${file}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
  } catch (error) {
    console.error("Database migration failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    if (lockAcquired) await client.query("SELECT pg_advisory_unlock($1)", [advisoryLockId]).catch(() => {});
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error("Database migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
