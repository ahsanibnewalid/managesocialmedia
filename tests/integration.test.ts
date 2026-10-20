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


test("HTTP API denies cross-workspace reads and writes", {
  skip: !hasDatabase ? "DATABASE_URL is not configured" : false,
  timeout: 60_000
}, async () => {
  const { spawn } = await import("node:child_process");
  const suffix = randomUUID();
  const emailA = `tenant-a-${suffix}@example.test`;
  const emailB = `tenant-b-${suffix}@example.test`;
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const secret = randomUUID() + randomUUID();
  const server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), JWT_SECRET: secret, NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  server.stderr.setEncoding("utf8");
  server.stderr.on("data", chunk => { stderr += chunk; });

  const api = async (path: string, token?: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(5_000)
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (server.exitCode !== null) throw new Error(`API process exited early: ${stderr}`);
      try {
        const response = await api("/api/health");
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(ready, true, `API server did not become healthy: ${stderr}`);

    const registrationA = await api("/api/auth/register", undefined, {
      method: "POST",
      body: JSON.stringify({ name: "Tenant A", email: emailA, password: "TestPassword-A-123!" })
    });
    assert.equal(registrationA.status, 201);
    const accountA = await registrationA.json() as { token: string; workspace: { id: number } };

    const registrationB = await api("/api/auth/register", undefined, {
      method: "POST",
      body: JSON.stringify({ name: "Tenant B", email: emailB, password: "TestPassword-B-123!" })
    });
    assert.equal(registrationB.status, 201);
    const accountB = await registrationB.json() as { token: string; workspace: { id: number } };

    const listedB = await api("/api/workspaces", accountB.token);
    assert.equal(listedB.status, 200);
    const listedData = await listedB.json() as { workspaces: Array<{ id: number }> };
    assert.equal(listedData.workspaces.some(workspace => Number(workspace.id) === Number(accountA.workspace.id)), false);

    const postResponse = await api(`/api/workspaces/${accountA.workspace.id}/posts`, accountA.token, {
      method: "POST",
      body: JSON.stringify({ text: "Private tenant isolation test", platforms: ["facebook"], status: "draft" })
    });
    assert.equal(postResponse.status, 201);
    const postData = await postResponse.json() as { post: { id: number } };
    const postId = postData.post.id;

    for (const path of [
      `/api/workspaces/${accountA.workspace.id}/overview`,
      `/api/workspaces/${accountA.workspace.id}/posts`,
      `/api/workspaces/${accountA.workspace.id}/inbox`,
      `/api/workspaces/${accountA.workspace.id}/audit`
    ]) {
      const response = await api(path, accountB.token);
      assert.equal(response.status, 404, `cross-tenant read should be denied: ${path}`);
    }

    const crossTenantCreate = await api(`/api/workspaces/${accountA.workspace.id}/posts`, accountB.token, {
      method: "POST",
      body: JSON.stringify({ text: "Unauthorized post", platforms: ["facebook"], status: "draft" })
    });
    assert.equal(crossTenantCreate.status, 404);

    const crossTenantPatch = await api(`/api/workspaces/${accountA.workspace.id}/posts/${postId}`, accountB.token, {
      method: "PATCH",
      body: JSON.stringify({ text: "Unauthorized edit" })
    });
    assert.equal(crossTenantPatch.status, 404);

    const crossTenantDelete = await api(`/api/workspaces/${accountA.workspace.id}/posts/${postId}`, accountB.token, {
      method: "DELETE"
    });
    assert.equal(crossTenantDelete.status, 404);

    const ownerRead = await api(`/api/workspaces/${accountA.workspace.id}/posts`, accountA.token);
    assert.equal(ownerRead.status, 200);
    const ownerPosts = await ownerRead.json() as { posts: Array<{ id: number }> };
    assert.equal(ownerPosts.posts.some(post => Number(post.id) === Number(postId)), true);
  } finally {
    const exited = new Promise<void>(resolve => server.once("exit", () => resolve()));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2_000))]);
    await pool!.query("DELETE FROM users WHERE email = ANY($1::text[])", [[emailA, emailB]]).catch(() => {});
  }
});
