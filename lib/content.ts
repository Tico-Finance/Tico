import { z } from "zod";
import { SITE_URL } from "./leads";

// Content tracking: what was published and what is planned, with performance numbers
// (read from screenshots) and the leads that came from each piece.

export const CONTENT_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "podcast", "other"] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  tiktok: "טיקטוק",
  youtube: "יוטיוב",
  podcast: "פודקאסט",
  other: "אחר",
};

export const CONTENT_FORMATS = ["post", "reel", "story", "carousel", "video", "podcast", "other"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: "פוסט",
  reel: "רילס",
  story: "סטורי",
  carousel: "קרוסלה",
  video: "סרטון",
  podcast: "פרק",
  other: "אחר",
};

export const CONTENT_STATUSES = ["idea", "planned", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "רעיון",
  planned: "מתוכנן",
  published: "פורסם",
};

export const METRIC_KEYS = ["views", "reach", "likes", "comments", "shares", "saves", "followers"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Partial<Record<MetricKey, number>>;
export const METRIC_LABELS: Record<MetricKey, string> = {
  views: "צפיות",
  reach: "חשיפה",
  likes: "לייקים",
  comments: "תגובות",
  shares: "שיתופים",
  saves: "שמירות",
  followers: "עוקבים חדשים",
};

/** Likes + comments + shares + saves. */
export function engagement(m: Metrics): number {
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
}

/** Engagement as a share of views (or reach when there are no views), or null when unknown. */
export function engagementRate(m: Metrics): number | null {
  const base = m.views || m.reach;
  if (!base) return null;
  return engagement(m) / base;
}

/** Link to the site with the content code, so a lead coming from this piece is attributed to it. */
export function contentLink(c: { platform: string; format: string; code: string }, path = "/check"): string {
  const q = new URLSearchParams({ utm_source: c.platform, utm_medium: c.format, utm_campaign: c.code });
  return `${SITE_URL}${path}?${q.toString()}`;
}

/** "1.2K", "3,400", "2M" and similar to a whole number, or null. */
export function parseCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/,/g, "").toUpperCase();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*([KM])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === "K" ? 1_000 : m[2] === "M" ? 1_000_000 : 1);
  return Math.round(n);
}

export function cleanMetrics(raw: Record<string, unknown> | null | undefined): Metrics {
  const out: Metrics = {};
  for (const k of METRIC_KEYS) {
    const n = parseCount(raw?.[k]);
    if (n !== null) out[k] = n;
  }
  return out;
}

// ── Summary for the "what works" view ──

export interface ContentLike {
  id: string;
  title: string;
  platform: string;
  format: string;
  topic: string | null;
  status: string;
  metrics: Metrics;
  code: string;
}

export interface GroupStat {
  key: string;
  count: number;
  withMetrics: number;
  avgViews: number | null;
  avgRate: number | null;
  leads: number;
}

function group(items: ContentLike[], leadsByCode: Record<string, number>, keyOf: (c: ContentLike) => string | null): GroupStat[] {
  const map = new Map<string, ContentLike[]>();
  for (const c of items) {
    const k = keyOf(c);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), c]);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return [...map.entries()]
    .map(([key, list]) => {
      const withM = list.filter((c) => (c.metrics.views ?? c.metrics.reach ?? 0) > 0);
      return {
        key,
        count: list.length,
        withMetrics: withM.length,
        avgViews: avg(withM.map((c) => c.metrics.views ?? c.metrics.reach ?? 0)),
        avgRate: avg(withM.map((c) => engagementRate(c.metrics)).filter((x): x is number => x !== null)),
        leads: list.reduce((s, c) => s + (leadsByCode[c.code] ?? 0), 0),
      };
    })
    .sort((a, b) => (b.avgViews ?? -1) - (a.avgViews ?? -1));
}

export function summarize(items: ContentLike[], leadsByCode: Record<string, number>) {
  const published = items.filter((c) => c.status === "published");
  return {
    byPlatform: group(published, leadsByCode, (c) => c.platform),
    byFormat: group(published, leadsByCode, (c) => c.format),
    byTopic: group(published, leadsByCode, (c) => c.topic?.trim() || null),
    top: [...published]
      .filter((c) => (c.metrics.views ?? c.metrics.reach ?? 0) > 0)
      .sort((a, b) => (b.metrics.views ?? b.metrics.reach ?? 0) - (a.metrics.views ?? a.metrics.reach ?? 0))
      .slice(0, 5),
  };
}

// ── Validation ──

const short = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(0).max(1_000_000_000);

export const metricsSchema = z.object({
  views: count.nullable().optional(),
  reach: count.nullable().optional(),
  likes: count.nullable().optional(),
  comments: count.nullable().optional(),
  shares: count.nullable().optional(),
  saves: count.nullable().optional(),
  followers: count.nullable().optional(),
});

export const contentInputSchema = z.object({
  title: short(200).min(1),
  platform: z.enum(CONTENT_PLATFORMS).default("instagram"),
  format: z.enum(CONTENT_FORMATS).default("post"),
  topic: short(120).optional().nullable(),
  status: z.enum(CONTENT_STATUSES).default("idea"),
  plannedAt: isoDate.optional().nullable(),
  publishedAt: isoDate.optional().nullable(),
  url: short(500).optional().nullable(),
  caption: short(5000).optional(),
  notes: short(2000).optional(),
});

export const contentPatchSchema = contentInputSchema.partial().extend({
  metrics: metricsSchema.optional(),
  insights: short(3000).optional().nullable(),
});
