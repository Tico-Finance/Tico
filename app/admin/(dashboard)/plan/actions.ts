"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { planEntries } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { closePlanYear, createPlanYear, listPlanYears, reopenPlanYear, savePlanYear } from "@/lib/plan-db";
import { nextYearSettings } from "@/lib/business-plan/targets";
import { defaultSettings } from "@/lib/business-plan/defaults";
import {
  entryKeyOf,
  entrySchemas,
  planSettingsSchema,
  type EntryKind,
} from "@/lib/business-plan/schemas";

type Result = { ok: true } | { ok: false; error: string };

const KINDS: EntryKind[] = ["day", "action", "expense"];
const isKind = (k: string): k is EntryKind => (KINDS as string[]).includes(k);

export async function savePlanSettingsAction(year: number, input: unknown): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return { ok: false, error: "שנה לא תקינה" };

  const parsed = planSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "הנתונים אינם תקינים" };

  const saved = await savePlanYear(userId, year, { ...parsed.data, start: 0 });
  return saved ? { ok: true } : { ok: false, error: "השנה הזאת סגורה. אפשר לפתוח אותה מחדש לעריכה." };
}

/** Finalize a year: its settings freeze together with a summary of plan against actual. */
export async function closePlanYearAction(year: number): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const summary = await closePlanYear(userId, year);
  if (!summary) return { ok: false, error: "אין תוכנית לשנה הזאת" };
  revalidatePath("/admin/plan");
  return { ok: true };
}

export async function reopenPlanYearAction(year: number): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  await reopenPlanYear(userId, year);
  revalidatePath("/admin/plan");
  return { ok: true };
}

/** Open `year` as a new plan that starts from the assumptions of the latest earlier year. */
export async function createPlanYearAction(year: number): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const rows = await listPlanYears(userId);
  const prev = rows.find((r) => r.year < year && r.settings);
  await createPlanYear(userId, year, nextYearSettings(prev?.settings ?? defaultSettings(new Date(year, 0, 1))));
  revalidatePath("/admin/plan");
  return { ok: true };
}

/** Insert or update logged entries (days, marketing actions, monthly expenses). */
export async function savePlanEntriesAction(
  kind: string,
  entries: unknown[]
): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!isKind(kind)) return { ok: false, error: "סוג לא מוכר" };
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 100) {
    return { ok: false, error: "בקשה לא תקינה" };
  }

  const rows: { userId: string; kind: EntryKind; key: string; data: Record<string, unknown> }[] = [];
  for (const raw of entries) {
    const parsed = entrySchemas[kind].safeParse(raw);
    if (!parsed.success) return { ok: false, error: "הנתונים אינם תקינים" };
    const data = parsed.data as Record<string, unknown>;
    const key = (entryKeyOf[kind] as (e: unknown) => string)(parsed.data);
    rows.push({ userId, kind, key, data });
  }

  await db
    .insert(planEntries)
    .values(rows)
    .onConflictDoUpdate({
      target: [planEntries.userId, planEntries.kind, planEntries.key],
      set: { data: sql`excluded.data`, updatedAt: new Date() },
    });
  return { ok: true };
}

export async function deletePlanEntriesAction(
  kind: string,
  keys: string[]
): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!isKind(kind)) return { ok: false, error: "סוג לא מוכר" };
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 200) {
    return { ok: false, error: "בקשה לא תקינה" };
  }

  await db
    .delete(planEntries)
    .where(
      and(
        eq(planEntries.userId, userId),
        eq(planEntries.kind, kind),
        inArray(planEntries.key, keys.map(String))
      )
    );
  return { ok: true };
}
