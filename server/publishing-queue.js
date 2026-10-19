const { Queue } = require("bullmq");
const IORedis = require("ioredis");

let connection;
let queue;

function getPublishingQueue() {
  if (queue) return queue;
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required to schedule posts");
  }

  connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
  queue = new Queue("tidepost-publishing", {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10000 },
      removeOnFail: false
    }
  });
  return queue;
}

async function enqueueScheduledPost(postId, scheduledAt) {
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
  return getPublishingQueue().add(
    "publish-post",
    { postId: String(postId) },
    { jobId: `post-${postId}`, delay }
  );
}

async function closePublishingQueue() {
  if (queue) await queue.close();
  if (connection) await connection.quit();
  queue = undefined;
  connection = undefined;
}

module.exports = { enqueueScheduledPost, closePublishingQueue };
