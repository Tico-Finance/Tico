import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import type { PlanSettings } from "@/lib/business-plan/types";
import { activePlan, listPlanYears, loadYearEntries } from "@/lib/plan-db";
import { todayIL } from "@/lib/partners";
import type { LeadRow } from "../leads/leads-board";
import { getCalendarEvents } from "@/lib/calendar";
import { buildDay } from "@/lib/day";
import HomeClient from "./home-client";

export const metadata = { title: "היום שלי | Tico" };

export default async function HomePage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");

  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.userId, userId))
    .orderBy(desc(leads.createdAt));
  const thisYear = Number(todayIL().slice(0, 4));
  const plan = activePlan(await listPlanYears(userId), thisYear);
  const settings: PlanSettings | null = plan?.settings ?? null;
  const days = plan ? (await loadYearEntries(userId, plan.year)).days : {};

  const initialLeads: LeadRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    groupName: r.groupName,
    postUrl: r.postUrl,
    topic: r.topic,
    type: r.type,
    stage: r.stage,
    nextStep: r.nextStep,
    nextAt: r.nextAt ? r.nextAt.toISOString() : null,
    value: r.value,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));

  const calendar = await getCalendarEvents();

  const matrix = await buildDay(userId);

  return <HomeClient leads={initialLeads} settings={settings} days={days} calendar={calendar} matrix={matrix} />;
}
