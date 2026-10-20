export interface RateLimitCounter {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

const incrementScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return count"
].join("\n");

export async function incrementWindowCounter(client: RateLimitCounter, key: string, windowSeconds: number): Promise<number> {
  const result = Number(await client.eval(incrementScript, 1, key, String(windowSeconds)));
  if (!Number.isSafeInteger(result) || result < 1) throw new Error("Rate-limit store returned an invalid counter");
  return result;
}

export async function checkRateLimits(
  client: RateLimitCounter,
  keys: string[],
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (!keys.length || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Invalid rate-limit configuration");
  }
  for (const key of keys) {
    if (await incrementWindowCounter(client, key, windowSeconds) > limit) return false;
  }
  return true;
}
