require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000
});
(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    await pool.query(sql);
    console.info("Tidepost database schema applied.");
  } catch (error) {
    console.error("Database migration failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
