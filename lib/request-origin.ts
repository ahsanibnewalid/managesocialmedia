import "server-only";
import type { NextRequest } from "next/server";
import { isTrustedMutationOrigin } from "@/lib/trusted-origin";

/**
 * Reject cross-origin browser mutations on cookie-authenticated endpoints.
 * APP_URL is the canonical externally visible origin and must be configured
 * in each deployment. Missing/invalid configuration fails closed.
 */
export function hasTrustedRequestOrigin(request: NextRequest): boolean {
  return isTrustedMutationOrigin(request.headers.get("origin"), process.env.APP_URL);
}
