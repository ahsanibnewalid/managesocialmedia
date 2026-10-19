import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncPublishedPostAnalytics } from "@/lib/services/analyticsSync";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Analytics sync is not configured" }, { status: 503 });
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const suppliedBytes = Buffer.from(supplied);
  const secretBytes = Buffer.from(secret);
  if (suppliedBytes.length !== secretBytes.length || !timingSafeEqual(suppliedBytes, secretBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncPublishedPostAnalytics();
  return NextResponse.json({ ok: result.errors === 0, ...result }, { status: result.errors ? 207 : 200 });
}
