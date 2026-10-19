import "server-only";
import { Pool } from "pg";

const globalForPg = globalThis as unknown as { tidepostPool?: Pool };
function getPool(): Pool {
  if (globalForPg.tidepostPool) return globalForPg.tidepostPool;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "tidepost-next"
  });
  if (process.env.NODE_ENV !== "production") globalForPg.tidepostPool = pool;
  return pool;
}
// Lazily initialize PostgreSQL so next build can compile without deployment secrets.
export const db = {
  query: ((...args: any[]) => getPool().query(...args)) as Pool["query"],
  connect: () => getPool().connect(),
  end: () => getPool().end()
};
