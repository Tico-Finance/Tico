import { and, eq, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientEvents, clients, contentItems, leads, partnerEvents, partners, tasks } from "@/drizzle/schema";
import { SENT_EVENT_KINDS, addDays, hoursAgo, todayIL } from "@/lib/partners";
import { buildPriorityTasks, dayToPlan, nextWorkday, nowIL, planDay, rankForFocus, summarizeGoals } from "@/lib/priorities";
import { loadProgress } from "@/lib/progress-db";
import { activePlan, listPlanYears } from "@/lib/plan-db";
import { weekGoalRows, weeklyTargets } from "@/lib/business-plan/targets";

/** Everything the home screen needs to show the day by the Eisenhower matrix. */
export async function buildDay(userId: string, at: Date = new Date()) {
  // The day by the Eisenhower matrix, in Israel time: today while there is working time left,
  // otherwise the next working day.
  const now = nowIL(at);
  const dp = dayToPlan(now);
  const [partnerRows, clientRows, contentRows, leadRows, taskRows, recentEvents, recentStages] = await Promise.all([
    db.select({ id: partners.id, name: partners.name, kind: partners.kind, stage: partners.stage, wave: partners.wave, priority: partners.priority, nextAt: partners.nextAt, nextAction: partners.nextAction, archived: partners.archived })
      .from(partners).where(and(eq(partners.userId, userId), eq(partners.archived, false))),
    db.select({ id: clients.id, name: clients.name, process: clients.process, stageIndex: clients.stageIndex, stageDueAt: clients.stageDueAt, status: clients.status, pendingMessage: clients.pendingMessage })
      .from(clients).where(and(eq(clients.userId, userId), eq(clients.status, "active"))),
    db.select({ id: contentItems.id, title: contentItems.title, format: contentItems.format, status: contentItems.status, plannedAt: contentItems.plannedAt, publishedAt: contentItems.publishedAt, metrics: contentItems.metrics })
      .from(contentItems).where(and(eq(contentItems.userId, userId), or(eq(contentItems.status, "planned"), gte(contentItems.publishedAt, addDays(now.date, -8))))),
    db.select({ id: leads.id, name: leads.name, stage: leads.stage, nextAt: leads.nextAt, nextStep: leads.nextStep })
      .from(leads).where(eq(leads.userId, userId)),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), or(eq(tasks.status, "open"), gte(tasks.doneAt, hoursAgo(36))))),
    db.select({ kind: partnerEvents.kind, at: partnerEvents.at })
      .from(partnerEvents).where(and(eq(partnerEvents.userId, userId), gte(partnerEvents.at, hoursAgo(36)))),
    db.select({ kind: clientEvents.kind, at: clientEvents.at })
      .from(clientEvents).where(and(eq(clientEvents.userId, userId), gte(clientEvents.at, hoursAgo(36)))),
  ]);
  const [weekly, planRows] = await Promise.all([loadProgress(userId, now.date, 6), listPlanYears(userId)]);
  // What the yearly plan asks for this week, against what was actually done.
  const plan = activePlan(planRows, Number(now.date.slice(0, 4)));
  const thisWeek = weekly[weekly.length - 1];
  const weekGoals = plan?.settings ? weekGoalRows(weeklyTargets(plan.settings, plan.year, now.date), thisWeek) : [];
  const priorityTasks = buildPriorityTasks(
    {
      partners: partnerRows,
      clients: clientRows,
      content: contentRows.map((c) => ({ id: c.id, title: c.title, format: c.format, status: c.status, plannedAt: c.plannedAt, publishedAt: c.publishedAt, hasMetrics: Object.keys(c.metrics ?? {}).length > 0 })),
      leads: leadRows.map((l) => ({ id: l.id, name: l.name, stage: l.stage, nextAt: l.nextAt ? todayIL(l.nextAt) : null, nextStep: l.nextStep })),
      manual: taskRows.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, important: t.important, estMinutes: t.estMinutes, goal: t.goal, quadrantOverride: t.quadrantOverride, status: t.status, postponed: t.postponed })),
    },
    dp.date
  );
  const todayEvents = <T extends { at: Date }>(rows: T[]) => rows.filter((e) => todayIL(e.at) === now.date);
  const moneyToday =
    todayEvents(recentStages).filter((e) => ["stage_done", "update_sent", "milestone"].includes(e.kind)).length +
    todayEvents(recentEvents).filter((e) => ["replied", "meetingSet", "met"].includes(e.kind)).length +
    taskRows.filter((t) => t.status === "done" && t.goal === "revenue" && t.doneAt && todayIL(t.doneAt) === now.date).length;
  return {
    tasks: priorityTasks,
    ranked: rankForFocus(priorityTasks),
    weekly,
    weekGoals,
    planYear: plan?.year ?? null,
    moneyToday,
    nowMinutes: now.minutes,
    plan: planDay(priorityTasks, dp.cursor),
    planDate: dp.date,
    isToday: dp.isToday,
    today: now.date,
    nextWorkday: nextWorkday(now.date),
    goals: summarizeGoals(priorityTasks),
    done: {
      messages: recentEvents.filter((e) => (SENT_EVENT_KINDS as string[]).includes(e.kind) && todayIL(e.at) === now.date).length,
      stages: recentStages.filter((e) => e.kind === "stage_done" && todayIL(e.at) === now.date).length,
      content: contentRows.filter((c) => c.status === "published" && c.publishedAt === now.date).length,
      tasks: taskRows.filter((t) => t.status === "done" && t.doneAt && todayIL(t.doneAt) === now.date).length,
    },
  };
}
