require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { Pool } = require("pg");
const { publishToPlatform } = require("./publishing-adapters");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required");

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  max: 5, connectionTimeoutMillis: 5000
});

async function ensureAttemptTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS publish_attempts (
      id BIGSERIAL PRIMARY KEY, post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL, attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('processing','succeeded','failed')),
      error TEXT, external_post_id TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS publish_attempts_post_idx ON publish_attempts(post_id, started_at DESC);
  `);
}

async function processPost(job) {
  const postId = Number(job.data.postId);
  if (!Number.isSafeInteger(postId) || postId <= 0) throw new Error("Invalid post ID in publishing job");
  const found = await pool.query("SELECT * FROM posts WHERE id=$1", [postId]);
  if (!found.rowCount) return;
  const post = found.rows[0];
  if (post.status === "published" || post.status === "draft") return;
  const recovering = post.status === "publishing" && (job.attemptsMade || 0) > 0;
  if (post.status !== "scheduled" && !recovering) return;
  if (!post.scheduled_at || new Date(post.scheduled_at).getTime() > Date.now()) throw new Error("Post is not due yet");

  const claim = await pool.query(
    "UPDATE posts SET status='publishing', updated_at=now() WHERE id=$1 AND (status='scheduled' OR (status='publishing' AND $2::boolean)) RETURNING id",
    [postId, recovering]
  );
  if (!claim.rowCount) return;
  const accounts = await pool.query(
    `SELECT id,platform,status,external_id,token_ciphertext,token_expires_at FROM social_accounts
      WHERE workspace_id=$1 AND platform=ANY($2::text[]) ORDER BY platform`,
    [post.workspace_id, post.platforms]
  );
  const byPlatform = new Map(accounts.rows.map(account => [account.platform, account]));
  const successes = await pool.query("SELECT DISTINCT platform FROM publish_attempts WHERE post_id=$1 AND status='succeeded'", [postId]);
  const alreadyPublished = new Set(successes.rows.map(row => row.platform));
  const errors = [];

  for (const platform of post.platforms) {
    if (alreadyPublished.has(platform)) continue;
    const account = byPlatform.get(platform);
    const started = await pool.query(
      "INSERT INTO publish_attempts(post_id,platform,attempt_number,status) VALUES($1,$2,$3,'processing') RETURNING id",
      [postId, platform, (job.attemptsMade || 0) + 1]
    );
    const attemptId = started.rows[0].id;
    try {
      if (!account || account.status !== "connected" || !account.token_ciphertext) {
        throw new Error(`No connected ${platform} account with a stored encrypted token`);
      }
      const result = await publishToPlatform({
        platform, post, account,
        persistRefreshedToken: async (ciphertext, expiresAt) => {
          await pool.query(
            "UPDATE social_accounts SET token_ciphertext=$1,token_expires_at=$2 WHERE id=$3 AND workspace_id=$4",
            [ciphertext, expiresAt || null, account.id, post.workspace_id]
          );
          account.token_ciphertext = ciphertext;
          account.token_expires_at = expiresAt || null;
        }
      });
      if (result.refreshedEncryptedToken) {
        await pool.query(
          "UPDATE social_accounts SET token_ciphertext=$1,token_expires_at=$2 WHERE id=$3 AND workspace_id=$4",
          [result.refreshedEncryptedToken, result.tokenExpiresAt || null, account.id, post.workspace_id]
        );
      }
      await pool.query("UPDATE publish_attempts SET status='succeeded',external_post_id=$1,finished_at=now() WHERE id=$2",
        [result.externalPostId, attemptId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publishing error";
      errors.push(`${platform}: ${message}`);
      await pool.query("UPDATE publish_attempts SET status='failed',error=$1,finished_at=now() WHERE id=$2",
        [message.slice(0, 4000), attemptId]);
      if (/HTTP (401|403)|token (expired|invalid|revoked)|reconnect|permission/i.test(message) && account) {
        await pool.query("UPDATE social_accounts SET status='error' WHERE id=$1 AND workspace_id=$2", [account.id, post.workspace_id]);
      }
    }
  }
  if (errors.length) {
    const finalAttempt = (job.attemptsMade || 0) + 1 >= (job.opts.attempts || 1);
    await pool.query("UPDATE posts SET status=$1,updated_at=now() WHERE id=$2 AND status='publishing'",
      [finalAttempt ? "failed" : "scheduled", postId]);
    if (!finalAttempt) throw new Error(errors.join("; "));
    console.error("Publishing exhausted retries", { postId, errors });
    return;
  }
  await pool.query("UPDATE posts SET status='published',published_at=now(),updated_at=now() WHERE id=$1 AND status='publishing'", [postId]);
}
async function main() {
  await ensureAttemptTable();
  const worker = new Worker("tidepost-publishing", processPost, { connection, concurrency: 5 });
  worker.on("completed", job => console.info("Publishing job completed", job.id));
  worker.on("failed", (job, error) => console.error("Publishing job failed", job?.id, error.message));
  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    await pool.end();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
main().catch(async error => {
  console.error("Publishing worker could not start:", error.message);
  await connection.quit().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
