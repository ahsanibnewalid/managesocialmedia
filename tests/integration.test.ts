import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import IORedis from "ioredis";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);
const pool = hasDatabase ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000
}) : null;

test("PostgreSQL schema and workspace tenant isolation", { skip: !hasDatabase ? "DATABASE_URL is not configured" : false }, async () => {
  const client = await pool!.connect();
  const suffix = randomUUID();
  try {
    const schema = await client.query("SELECT to_regclass('public.users') AS users, to_regclass('public.workspace_members') AS memberships, to_regclass('public.oauth_states') AS oauth_states, to_regclass('public.post_analytics') AS post_analytics");
    assert.ok(schema.rows[0].users && schema.rows[0].memberships && schema.rows[0].oauth_states && schema.rows[0].post_analytics, "run npm run db:migrate before integration tests");
    await client.query("BEGIN");
    const userA = (await client.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id", ["Tenant A", `a-${suffix}@example.test`, "test-hash"])).rows[0].id;
    const userB = (await client.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id", ["Tenant B", `b-${suffix}@example.test`, "test-hash"])).rows[0].id;
    const workspace = (await client.query("INSERT INTO workspaces(name,owner_id) VALUES($1,$2) RETURNING id", ["Tenant A workspace", userA])).rows[0].id;
    await client.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')", [workspace, userA]);
    const unauthorized = await client.query("SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [workspace, userB]);
    assert.equal(unauthorized.rowCount, 0, "a different user must not gain workspace membership");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
});

test("Redis connection is reachable", { skip: !hasRedis ? "REDIS_URL is not configured" : false }, async () => {
  const redis = new IORedis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000 });
  try {
    await redis.connect();
    assert.equal(await redis.ping(), "PONG");
  } finally { await redis.quit().catch(() => {}); }
});

test("PostgreSQL and Redis live integration availability", { skip: !(hasDatabase && hasRedis) ? "Set DATABASE_URL and REDIS_URL to run live integration checks" : false }, async () => {
  assert.ok(pool);
  const result = await pool!.query("SELECT 1 AS healthy");
  assert.equal(result.rows[0].healthy, 1);
});

after(async () => { await pool?.end(); });
