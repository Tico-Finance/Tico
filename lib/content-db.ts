import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentItems, draftPosts, leads } from "@/drizzle/schema";
import { cleanMetrics, type Metrics } from "@/lib/content";
import { todayIL } from "@/lib/partners";

// Database operations for content tracking. They take the user id explicitly, so server actions
// stay thin (auth + validation) and these can be exercised against a test database.

export type ContentRecord = typeof contentItems.$inferSelect;

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** 6 lowercase letters and digits: short enough for a link, long enough not to collide. */
export function newCode(): string {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6).padEnd(6, "0");
}

async function insertWithCode(userId: string, values: Omit<typeof contentItems.$inferInsert, "userId" | "code">): Promise<ContentRecord> {
  for (let i = 0; i < 5; i++) {
    const [row] = await db
      .insert(contentItems)
      .values({ ...values, userId, code: newCode() })
      .onConflictDoNothing({ target: [contentItems.userId, contentItems.code] })
      .returning();
    if (row) return row;
  }
  throw new Error("could not allocate a content code");
}

export interface ContentInput {
  title: string;
  platform?: string;
  format?: string;
  topic?: string | null;
  status?: string;
  plannedAt?: string | null;
  publishedAt?: string | null;
  url?: string | null;
  caption?: string;
  notes?: string;
}

export async function createContent(userId: string, input: ContentInput): Promise<ContentRecord> {
  const published = input.status === "published";
  return insertWithCode(userId, {
    title: input.title,
    platform: input.platform ?? "instagram",
    format: input.format ?? "post",
    topic: clean(input.topic),
    status: input.status ?? "idea",
    plannedAt: input.plannedAt ?? null,
    publishedAt: input.publishedAt ?? (published ? todayIL() : null),
    url: clean(input.url),
    caption: input.caption ?? "",
    notes: input.notes ?? "",
  });
}

export interface ContentPatch extends Partial<ContentInput> {
  metrics?: Record<string, number | null | undefined>;
  insights?: string | null;
}

export async function updateContent(
  userId: string,
  id: string,
  patch: ContentPatch,
  today: string = todayIL()
): Promise<ContentRecord | null> {
  const [current] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId))).limit(1);
  if (!current) return null;
  const set: Partial<typeof contentItems.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.platform !== undefined) set.platform = patch.platform;
  if (patch.format !== undefined) set.format = patch.format;
  if (patch.topic !== undefined) set.topic = clean(patch.topic);
  if (patch.plannedAt !== undefined) set.plannedAt = patch.plannedAt;
  if (patch.publishedAt !== undefined) set.publishedAt = patch.publishedAt;
  if (patch.url !== undefined) set.url = clean(patch.url);
  if (patch.caption !== undefined) set.caption = patch.caption;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.insights !== undefined) set.insights = clean(patch.insights);
  if (patch.status !== undefined) {
    set.status = patch.status;
    // Marking something as published stamps the date unless one was given.
    if (patch.status === "published" && !current.publishedAt && patch.publishedAt === undefined) set.publishedAt = today;
  }
  if (patch.metrics !== undefined) {
    // null clears a number; anything else replaces it.
    const merged: Metrics = { ...(current.metrics as Metrics) };
    for (const [k, v] of Object.entries(patch.metrics)) {
      if (v === null) delete merged[k as keyof Metrics];
    }
    Object.assign(merged, cleanMetrics(Object.fromEntries(Object.entries(patch.metrics).filter(([, v]) => v !== null))));
    set.metrics = merged as Record<string, number>;
    set.metricsAt = new Date();
  }
  const [row] = await db.update(contentItems).set(set).where(eq(contentItems.id, id)).returning();
  return row ?? null;
}

/** Store a screenshot and what was read from it. Numbers read from the screenshot replace the old ones. */
export async function attachScreenshot(
  userId: string,
  id: string,
  shot: { url: string; metrics: Metrics; insights: string[] }
): Promise<ContentRecord | null> {
  const [current] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId))).limit(1);
  if (!current) return null;
  const [row] = await db
    .update(contentItems)
    .set({
      screenshots: [...current.screenshots, shot.url].slice(-6),
      metrics: { ...(current.metrics as Metrics), ...shot.metrics } as Record<string, number>,
      metricsAt: new Date(),
      insights: shot.insights.length ? shot.insights.map((x) => `• ${x}`).join("\n") : current.insights,
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, id))
    .returning();
  return row ?? null;
}

export async function getContent(userId: string, id: string): Promise<ContentRecord | null> {
  const [row] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId))).limit(1);
  return row ?? null;
}

export async function deleteContent(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId))).returning({ id: contentItems.id });
  return rows.length > 0;
}

/** Published drafts that are not tracked yet become content items (once each). */
export async function importPublishedDrafts(userId: string): Promise<ContentRecord[]> {
  const published = await db
    .select()
    .from(draftPosts)
    .where(and(eq(draftPosts.status, "published"), isNotNull(draftPosts.publishedAt)));
  const linked = await db
    .select({ id: contentItems.draftPostId })
    .from(contentItems)
    .where(and(eq(contentItems.userId, userId), isNotNull(contentItems.draftPostId)));
  const have = new Set(linked.map((l) => l.id));
  const out: ContentRecord[] = [];
  for (const d of published) {
    if (have.has(d.id)) continue;
    const caption = d.finalCaptionInstagram || d.finalCaptionFacebook || d.aiCaptionInstagram || d.aiCaptionFacebook || "";
    const title = (d.overlayHook || caption).replace(/\s+/g, " ").trim().slice(0, 80) || "פוסט שפורסם";
    const platform = d.instagramPostId ? "instagram" : d.facebookPostId ? "facebook" : d.platform === "facebook" ? "facebook" : "instagram";
    const row = await insertWithCode(userId, {
      title,
      platform,
      format: d.imageUrls.length > 1 ? "carousel" : "post",
      status: "published",
      publishedAt: d.publishedAt ? todayIL(d.publishedAt) : null,
      caption,
      draftPostId: d.id,
    });
    out.push(row);
  }
  return out;
}

/** Leads per content code (the utm_campaign they arrived with). */
export async function leadCountsByCode(userId: string, codes: string[]): Promise<Record<string, number>> {
  if (!codes.length) return {};
  const rows = await db
    .select({ campaign: leads.campaign })
    .from(leads)
    .where(and(eq(leads.userId, userId), inArray(leads.campaign, codes)));
  const out: Record<string, number> = {};
  for (const r of rows) if (r.campaign) out[r.campaign] = (out[r.campaign] ?? 0) + 1;
  return out;
}
