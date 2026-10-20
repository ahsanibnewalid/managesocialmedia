import "server-only";
import IORedis from "ioredis";
import { db } from "@/lib/db";

type RateLimitInput = {
  key: string;
  limit: number;
  windowSec: number;
};

type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
};

const globalRateLimit = globalThis as unknown as { rateLimitRedis?: IORedis };

function getRedisClient() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required");

  if (!globalRateLimit.rateLimitRedis || globalRateLimit.rateLimitRedis.status === "end") {
    globalRateLimit.rateLimitRedis = new IORedis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000
    });
  }

  return globalRateLimit.rateLimitRedis;
}

async function redisRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % input.windowSec);
  const resetAt = windowStart + input.windowSec;
  const redisKey = `rate_limit:${input.key}:${windowStart}`;
  const redis = getRedisClient();

  if (redis.status === "wait") await redis.connect();

  const tx = redis.multi();
  tx.incr(redisKey);
  tx.expire(redisKey, input.windowSec, "NX");
  const result = await tx.exec();
  const count = Number(result?.[0]?.[1] ?? 0);

  return {
    allowed: count <= input.limit,
    count,
    remaining: Math.max(input.limit - count, 0),
    retryAfterSec: Math.max(resetAt - nowSec, 1)
  };
}

async function postgresRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % input.windowSec);
  const resetAt = windowStart + input.windowSec;

  const result = await db.query(
    `INSERT INTO rate_limit_bucket(key, window_start, count)
     VALUES($1, to_timestamp($2), 1)
     ON CONFLICT(key) DO UPDATE SET
       window_start = EXCLUDED.window_start,
       count = CASE
         WHEN rate_limit_bucket.window_start = EXCLUDED.window_start THEN rate_limit_bucket.count + 1
         ELSE 1
       END
     RETURNING count`,
    [input.key, windowStart]
  );

  const count = Number((result.rows[0] as { count?: number } | undefined)?.count ?? 0);
  return {
    allowed: count <= input.limit,
    count,
    remaining: Math.max(input.limit - count, 0),
    retryAfterSec: Math.max(resetAt - nowSec, 1)
  };
}

export async function rateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  try {
    return await redisRateLimit(input);
  } catch {
    return postgresRateLimit(input);
  }
}
