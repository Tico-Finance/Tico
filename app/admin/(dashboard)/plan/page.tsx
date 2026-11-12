import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { todayIL } from "@/lib/partners";
import type { ActionEntry, PlanData } from "@/lib/business-plan/types";
import { activePlan, listPlanYears, loadYearEntries } from "@/lib/plan-db";
import PlanClient from "./plan-client";
import "./plan.css";

export const metadata = { title: "תוכנית עסקית | Tico" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");

  const thisYear = Number(todayIL().slice(0, 4));
  const rows = await listPlanYears(userId);
  const asked = Number((await searchParams).year);
  const year = Number.isInteger(asked) && asked >= 2024 && asked <= 2100 ? asked : activePlan(rows, thisYear)?.year ?? thisYear;
  const row = rows.find((r) => r.year === year) ?? null;

  const { days, expenses, all } = await loadYearEntries(userId, year);
  const actions: Record<string, ActionEntry> = {};
  for (const e of all) if (e.kind === "action" && e.key && (e.data as { date?: string }).date?.startsWith(`${year}-`)) actions[e.key] = e.data as unknown as ActionEntry;

  const initial: PlanData = { settings: row?.settings ?? null, days, actions, expenses };
  const known = new Set(rows.map((r) => r.year));
  return (
    <PlanClient
      key={year}
      initial={initial}
      year={year}
      closed={!!row?.closedAt}
      summary={row?.summary ?? null}
      years={rows.map((r) => ({ year: r.year, closed: !!r.closedAt })).reverse()}
      canOpen={[thisYear, thisYear + 1].filter((y) => !known.has(y) && y !== year)}
    />
  );
}
