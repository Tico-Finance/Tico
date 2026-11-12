import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientEvents, contentItems, leads, partnerEvents, tasks } from "@/drizzle/schema";
import { addDays } from "@/lib/partners";
import { buildProgress, weekStartOf, type WeekStats } from "@/lib/progress";

/** Progress for the last `weeks` weeks (oldest first). */
export async function loadProgress(userId: string, today: string, weeks = 8): Promise<WeekStats[]> {
  const first = addDays(weekStartOf(today), -7 * (weeks - 1));
  // A margin before the first Sunday covers the Israel/UTC offset; the builder filters by Israel date.
  const since = new Date(`${addDays(first, -1)}T00:00:00Z`);
  const [pe, ce, content, ls, ts] = await Promise.all([
    db.select({ kind: partnerEvents.kind, at: partnerEvents.at }).from(partnerEvents).where(and(eq(partnerEvents.userId, userId), gte(partnerEvents.at, since))),
    db.select({ kind: clientEvents.kind, text: clientEvents.text, at: clientEvents.at }).from(clientEvents).where(and(eq(clientEvents.userId, userId), gte(clientEvents.at, since))),
    db.select({ publishedAt: contentItems.publishedAt }).from(contentItems).where(and(eq(contentItems.userId, userId), gte(contentItems.publishedAt, first))),
    db.select({ createdAt: leads.createdAt }).from(leads).where(and(eq(leads.userId, userId), gte(leads.createdAt, since))),
    db.select({ doneAt: tasks.doneAt, goal: tasks.goal }).from(tasks).where(and(eq(tasks.userId, userId), gte(tasks.doneAt, since))),
  ]);
  return buildProgress({ partnerEvents: pe, clientEvents: ce, content, leads: ls, tasks: ts }, today, weeks);
}
