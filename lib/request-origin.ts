import "server-only";
import type { NextRequest } from "next/server";

/**
 * Reject cross-origin browser mutations on cookie-authenticated endpoints.
 * APP_URL is the canonical externally visible origin and must be configured
 * in each deployment. Missing/invalid configuration fails closed.
 */
export function hasTrustedRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const configuredAppUrl = process.env.APP_URL;
  if (!origin || !configuredAppUrl) return false;

  try {
    const originUrl = new URL(origin);
    const appUrl = new URL(configuredAppUrl);
    if (!["http:", "https:"].includes(originUrl.protocol)) return false;
    if (!["http:", "https:"].includes(appUrl.protocol)) return false;
    return originUrl.origin === appUrl.origin;
  } catch {
    return false;
  }
}
