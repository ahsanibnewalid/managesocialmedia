import "server-only";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { tidepostRedis?: IORedis };
export function getRedisConnection(): IORedis {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required for scheduled publishing");
  if (!globalForRedis.tidepostRedis || globalForRedis.tidepostRedis.status === "end") {
    globalForRedis.tidepostRedis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }
  return globalForRedis.tidepostRedis;
}
export async function closeRedisConnection() {
  const redis = globalForRedis.tidepostRedis;
  if (redis && redis.status !== "end") await redis.quit();
  delete globalForRedis.tidepostRedis;
}
