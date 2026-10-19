import "server-only";
import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

const globalForQueue = globalThis as unknown as { tidepostQueue?: Queue };
export function getPublishingQueue() {
  if (!globalForQueue.tidepostQueue) {
    globalForQueue.tidepostQueue = new Queue("tidepost-publishing", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
        removeOnFail: false
      }
    });
  }
  return globalForQueue.tidepostQueue;
}
export async function enqueueScheduledPost(postId: string | number, scheduledAt: Date | string) {
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
  return getPublishingQueue().add("publish-post", { postId: String(postId) }, {
    jobId: `post-${postId}`, delay
  });
}
