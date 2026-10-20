import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimits, type RateLimitCounter } from "../lib/auth-rate-limit-core";

class FakeCounter implements RateLimitCounter {
  counts = new Map<string, number>();
  windows = new Map<string, number>();
  async eval(_script: string, numberOfKeys: number, ...args: Array<string | number>) {
    assert.equal(numberOfKeys, 1);
    const key = String(args[0]);
    const windowSeconds = Number(args[1]);
    this.windows.set(key, windowSeconds);
    const count = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, count);
    return count;
  }
}

test("rate limits increment all configured dimensions with the expected window", async () => {
  const redis = new FakeCounter();
  assert.equal(await checkRateLimits(redis, ["email-key", "ip-key"], 2, 900), true);
  assert.equal(await checkRateLimits(redis, ["email-key", "ip-key"], 2, 900), true);
  assert.equal(await checkRateLimits(redis, ["email-key", "ip-key"], 2, 900), false);
  assert.equal(redis.counts.get("email-key"), 3);
  assert.equal(redis.counts.get("ip-key"), 2);
  assert.equal(redis.windows.get("email-key"), 900);
});

test("rate limiter rejects invalid configuration", async () => {
  const redis = new FakeCounter();
  await assert.rejects(checkRateLimits(redis, [], 2, 900), /Invalid rate-limit configuration/);
  await assert.rejects(checkRateLimits(redis, ["email"], 0, 900), /Invalid rate-limit configuration/);
});
