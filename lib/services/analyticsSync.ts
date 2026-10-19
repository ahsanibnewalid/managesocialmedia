import "server-only";
import { db } from "@/lib/db";
import { decryptSocialToken } from "@/lib/social-token-vault";

type Metric = { reach?: number | null; impressions?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; clicks?: number | null };
async function json(url: string, token: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok || (body.error && body.error.code !== "ok")) throw new Error(`Analytics provider request failed (HTTP ${response.status})`);
  return body;
}
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}
function graphMetric(body: any, name: string): number | null {
  const entry = Array.isArray(body?.data) ? body.data.find((item: any) => item.name === name) : undefined;
  const value = entry?.values?.[0]?.value;
  return numberOrNull(typeof value === "number" ? value : null);
}
async function readMetrics(platform: string, externalId: string, token: string): Promise<Metric | null> {
  if (platform === "facebook") {
    const version = process.env.META_GRAPH_API_VERSION;
    if (!version) throw new Error("META_GRAPH_API_VERSION is required for analytics");
    const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(externalId)}/insights`);
    url.searchParams.set("metric", "post_impressions,post_impressions_unique");
    const result = await json(url.toString(), token);
    return { impressions: graphMetric(result, "post_impressions"), reach: graphMetric(result, "post_impressions_unique") };
  }
  if (platform === "instagram") {
    const version = process.env.META_GRAPH_API_VERSION;
    if (!version) throw new Error("META_GRAPH_API_VERSION is required for analytics");
    const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(externalId)}/insights`);
    url.searchParams.set("metric", "reach,likes,comments,saved,shares");
    const result = await json(url.toString(), token);
    return { reach: graphMetric(result, "reach"), likes: graphMetric(result, "likes"), comments: graphMetric(result, "comments"), shares: graphMetric(result, "shares") };
  }
  if (platform === "x") {
    const result = await json(`https://api.x.com/2/tweets?ids=${encodeURIComponent(externalId)}&tweet.fields=public_metrics`, token);
    const metrics = result.data?.[0]?.public_metrics;
    if (!metrics) return null;
    return { likes: numberOrNull(metrics.like_count), comments: numberOrNull(metrics.reply_count), shares: numberOrNull(metrics.retweet_count), clicks: null };
  }
  if (platform === "tiktok") {
    const result = await json("https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count", token, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filters: { video_ids: [externalId] } })
    });
    const video = result.data?.videos?.[0];
    if (!video) return null;
    return { impressions: numberOrNull(video.view_count), reach: numberOrNull(video.view_count), likes: numberOrNull(video.like_count), comments: numberOrNull(video.comment_count), shares: numberOrNull(video.share_count) };
  }
  // LinkedIn post analytics depends on organization/member permissions and supported API product access.
  // Fail closed instead of inventing a metric or querying an unsupported endpoint.
  return null;
}
export async function syncPublishedPostAnalytics(): Promise<{ synced: number; skipped: number; errors: number }> {
  const posts = await db.query(`
    SELECT pa.post_id, pa.platform, pa.external_post_id, sa.token_ciphertext
    FROM publish_attempts pa
    JOIN posts p ON p.id=pa.post_id
    JOIN social_accounts sa ON sa.workspace_id=p.workspace_id AND sa.platform=pa.platform
    WHERE pa.status='succeeded' AND pa.external_post_id IS NOT NULL
      AND sa.status='connected' AND sa.token_ciphertext IS NOT NULL
    ORDER BY pa.finished_at DESC NULLS LAST
    LIMIT 250
  `);
  let synced = 0, skipped = 0, errors = 0;
  for (const row of posts.rows) {
    try {
      const token = decryptSocialToken(row.token_ciphertext);
      const metric = await readMetrics(row.platform, row.external_post_id, token.accessToken);
      if (!metric || Object.values(metric).every(value => value == null)) { skipped++; continue; }
      await db.query(`
        INSERT INTO post_analytics(post_id,platform,external_post_id,reach,impressions,likes,comments,shares,clicks,synced_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        ON CONFLICT(post_id,platform) DO UPDATE SET external_post_id=EXCLUDED.external_post_id,
          reach=COALESCE(EXCLUDED.reach,post_analytics.reach),
          impressions=COALESCE(EXCLUDED.impressions,post_analytics.impressions),
          likes=COALESCE(EXCLUDED.likes,post_analytics.likes),
          comments=COALESCE(EXCLUDED.comments,post_analytics.comments),
          shares=COALESCE(EXCLUDED.shares,post_analytics.shares),
          clicks=COALESCE(EXCLUDED.clicks,post_analytics.clicks),synced_at=now()
      `, [row.post_id,row.platform,row.external_post_id,metric.reach ?? null,metric.impressions ?? null,metric.likes ?? null,metric.comments ?? null,metric.shares ?? null,metric.clicks ?? null]);
      synced++;
    } catch (error) {
      errors++;
      console.warn("Analytics sync failed for a post", { platform: row.platform, postId: row.post_id, reason: error instanceof Error ? error.message : "unknown error" });
    }
  }
  return { synced, skipped, errors };
}
