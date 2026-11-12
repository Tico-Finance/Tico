import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contentItems, leads, partnerEvents, partners, planEntries, planSettings } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import { planSettingsSchema } from "@/lib/business-plan/schemas";
import type { DayEntry, PlanSettings } from "@/lib/business-plan/types";
import type { LeadRow } from "../leads/leads-board";
import { getCalendarEvents } from "@/lib/calendar";
import { buildAgenda } from "@/lib/agenda";
import { SENT_EVENT_KINDS, hoursAgo, todayIL } from "@/lib/partners";
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
  const [settingsRow] = await db
    .select()
    .from(planSettings)
    .where(eq(planSettings.userId, userId))
    .limit(1);
  const dayRows = await db.select().from(planEntries).where(eq(planEntries.userId, userId));

  const parsed = settingsRow ? planSettingsSchema.safeParse(settingsRow.data) : null;
  const settings: PlanSettings | null = parsed?.success ? parsed.data : null;
  const days: Record<string, DayEntry> = {};
  for (const e of dayRows) if (e.kind === "day") days[e.key] = e.data as unknown as DayEntry;

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

  // What is waiting across partners, clients and content (Israel date).
  const today = todayIL();
  const [partnerRows, clientRows, contentRows, recentEvents] = await Promise.all([
    db.select({ id: partners.id, name: partners.name, stage: partners.stage, nextAt: partners.nextAt, nextAction: partners.nextAction, archived: partners.archived })
      .from(partners).where(and(eq(partners.userId, userId), eq(partners.archived, false))),
    db.select({ id: clients.id, name: clients.name, process: clients.process, stageIndex: clients.stageIndex, stageDueAt: clients.stageDueAt, status: clients.status, pendingMessage: clients.pendingMessage })
      .from(clients).where(and(eq(clients.userId, userId), eq(clients.status, "active"))),
    db.select({ id: contentItems.id, title: contentItems.title, status: contentItems.status, plannedAt: contentItems.plannedAt })
      .from(contentItems).where(and(eq(contentItems.userId, userId), eq(contentItems.status, "planned"))),
    db.select({ kind: partnerEvents.kind, at: partnerEvents.at })
      .from(partnerEvents).where(and(eq(partnerEvents.userId, userId), gte(partnerEvents.at, hoursAgo(36)))),
  ]);
  const sentToday = recentEvents.filter((e) => (SENT_EVENT_KINDS as string[]).includes(e.kind) && todayIL(e.at) === today).length;
  const agenda = buildAgenda({ partners: partnerRows, clients: clientRows, content: contentRows, sentToday }, today);

  return <HomeClient leads={initialLeads} settings={settings} days={days} calendar={calendar} agenda={agenda} />;
}
