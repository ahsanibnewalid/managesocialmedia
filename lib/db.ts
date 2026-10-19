import "server-only";
import { Pool } from "pg";

const globalForPg = globalThis as unknown as { tidepostPool?: Pool };
function createPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "tidepost-next"
  });
}
export const db = globalForPg.tidepostPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPg.tidepostPool = db;
