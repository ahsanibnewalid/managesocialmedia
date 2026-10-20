import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getRedisConnection } from "@/lib/redis";
import { checkRateLimits } from "@/lib/auth-rate-limit-core";

export type AuthRateLimitDecision = "allowed" | "limited" | "unavailable";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Apply shared, atomic Redis rate limits to auth server actions.
 * The reverse proxy must overwrite X-Forwarded-For; the last hop is used to
 * avoid trusting a client-supplied left-most value.
 */
export async function checkAuthRateLimit(action: "login" | "register", email: string): Promise<AuthRateLimitDecision> {
  const requestHeaders = await headers();
  const forwarded = (requestHeaders.get("x-forwarded-for") || "").split(",").map(value => value.trim()).filter(Boolean);
  const ip = forwarded.at(-1) || requestHeaders.get("x-real-ip")?.trim() || "";
  const normalizedEmail = email.trim().toLowerCase();
  const keys = [`tidepost:auth:${action}:email:${digest(normalizedEmail)}`];
  if (ip) keys.push(`tidepost:auth:${action}:ip:${digest(ip)}`);
  const limit = action === "login" ? 10 : 8;
  const windowSeconds = action === "login" ? 15 * 60 : 60 * 60;
  try {
    return await checkRateLimits(getRedisConnection(), keys, limit, windowSeconds) ? "allowed" : "limited";
  } catch (error) {
    console.error("Authentication rate-limit store unavailable", error instanceof Error ? error.message : "unknown error");
    // Fail closed in production rather than silently disabling brute-force controls.
    return process.env.NODE_ENV === "production" ? "unavailable" : "allowed";
  }
}
