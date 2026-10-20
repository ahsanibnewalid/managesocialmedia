import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { applySecurityHeaders } from "@/lib/securityHeaders";

export const runtime = "nodejs";

function isRateLimitedPath(pathname: string) {
  return pathname.startsWith("/api/auth/") || pathname.startsWith("/api/social/");
}

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (request as NextRequest & { ip?: string }).ip;
  return forwarded || ip || "unknown";
}

export async function middleware(request: NextRequest) {
  if (!isRateLimitedPath(request.nextUrl.pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  const ip = requestIp(request);
  const limit = request.nextUrl.pathname.startsWith("/api/auth/") ? 20 : 60;
  const windowSec = 60;
  const result = await rateLimit({ key: `${request.nextUrl.pathname}:${ip}`, limit, windowSec });

  if (!result.allowed) {
    const blocked = NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0"
        }
      }
    );

    return applySecurityHeaders(blocked);
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.retryAfterSec));
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/:path*"]
};
