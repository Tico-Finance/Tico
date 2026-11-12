import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planEntries, planSettings } from "@/drizzle/schema";
import { planSettingsSchema } from "@/lib/business-plan/schemas";
import type { DayEntry, ExpenseEntry, PlanSettings } from "@/lib/business-plan/types";
import { summarizeYear, yearSettings, type YearSummary } from "@/lib/business-plan/targets";

export interface PlanYearRow {
  year: number;
  settings: PlanSettings | null;
  closedAt: Date | null;
  summary: YearSummary | null;
}

const asJson = (s: PlanSettings) => s as unknown as Record<string, unknown>;

const toRow = (r: typeof planSettings.$inferSelect): PlanYearRow => {
  const parsed = planSettingsSchema.safeParse(r.data);
  return {
    year: r.year,
    settings: parsed.success ? yearSettings(parsed.data) : null,
    closedAt: r.closedAt,
    summary: (r.summary as unknown as YearSummary | null) ?? null,
  };
};

/** Every saved plan, newest year first. */
export async function listPlanYears(userId: string): Promise<PlanYearRow[]> {
  const rows = await db.select().from(planSettings).where(eq(planSettings.userId, userId)).orderBy(desc(planSettings.year));
  return rows.map(toRow);
}

/** The plan that drives today's screens: the finished plan of the current calendar year, if there is one. */
export function activePlan(rows: PlanYearRow[], thisYear: number): PlanYearRow | null {
  return rows.find((r) => r.year === thisYear && r.settings?.done) ?? null;
}

export async function savePlanYear(userId: string, year: number, data: PlanSettings): Promise<boolean> {
  const [cur] = await db.select({ closedAt: planSettings.closedAt }).from(planSettings).where(and(eq(planSettings.userId, userId), eq(planSettings.year, year))).limit(1);
  if (cur?.closedAt) return false; // a closed year is frozen
  await db.insert(planSettings).values({ userId, year, data: asJson(data) })
    .onConflictDoUpdate({ target: [planSettings.userId, planSettings.year], set: { data: asJson(data), updatedAt: new Date() } });
  return true;
}

export async function loadYearEntries(userId: string, year: number) {
  const rows = await db.select().from(planEntries).where(eq(planEntries.userId, userId));
  const days: Record<string, DayEntry> = {};
  const expenses: Record<string, ExpenseEntry> = {};
  for (const e of rows) {
    if (e.kind === "day" && e.key.startsWith(`${year}-`)) days[e.key] = e.data as unknown as DayEntry;
    else if (e.kind === "expense" && e.key.startsWith(`${year}-`)) expenses[e.key] = e.data as unknown as ExpenseEntry;
  }
  return { days, expenses, all: rows };
}

/** Freeze the year: plan vs actual is stored with it and the settings can no longer change. */
export async function closePlanYear(userId: string, year: number): Promise<YearSummary | null> {
  const [row] = await db.select().from(planSettings).where(and(eq(planSettings.userId, userId), eq(planSettings.year, year))).limit(1);
  if (!row) return null;
  const parsed = planSettingsSchema.safeParse(row.data);
  if (!parsed.success) return null;
  const { days, expenses } = await loadYearEntries(userId, year);
  const spent = Object.values(expenses).reduce((a, e) => a + e.amount, 0);
  const summary = summarizeYear(yearSettings(parsed.data), year, days, spent > 0 ? spent : null);
  await db.update(planSettings).set({ closedAt: new Date(), summary: summary as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(and(eq(planSettings.userId, userId), eq(planSettings.year, year)));
  return summary;
}

export async function reopenPlanYear(userId: string, year: number): Promise<void> {
  await db.update(planSettings).set({ closedAt: null, updatedAt: new Date() }).where(and(eq(planSettings.userId, userId), eq(planSettings.year, year)));
}

/** Start the next year's plan from the previous one (only if it does not exist yet). */
export async function createPlanYear(userId: string, year: number, from: PlanSettings): Promise<void> {
  await db.insert(planSettings).values({ userId, year, data: asJson(from) }).onConflictDoNothing();
}
