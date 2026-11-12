import type { contentItems } from "@/drizzle/schema";
import type { Metrics } from "@/lib/content";

export interface ContentRow {
  id: string;
  code: string;
  title: string;
  platform: string;
  format: string;
  topic: string | null;
  status: string;
  plannedAt: string | null;
  publishedAt: string | null;
  url: string | null;
  caption: string;
  notes: string;
  fromDraft: boolean;
  metrics: Metrics;
  metricsAt: string | null;
  screenshots: string[];
  insights: string | null;
}

export function toContentRow(r: typeof contentItems.$inferSelect): ContentRow {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    platform: r.platform,
    format: r.format,
    topic: r.topic,
    status: r.status,
    plannedAt: r.plannedAt,
    publishedAt: r.publishedAt,
    url: r.url,
    caption: r.caption,
    notes: r.notes,
    fromDraft: r.draftPostId !== null,
    metrics: (r.metrics ?? {}) as Metrics,
    metricsAt: r.metricsAt ? r.metricsAt.toISOString() : null,
    screenshots: r.screenshots ?? [],
    insights: r.insights,
  };
}
