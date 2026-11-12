import type { DayEntry, PlanSettings } from "./types";
import { buildParams, buildPlan, type Plan } from "./model";
import { dim } from "./dates";

// Everything the daily and weekly screens ask of him comes from the yearly plan: the income
// target fixes how many files must be signed, which fixes meetings, leads, content and outreach.

/** Share of partner messages that get an answer, and of answers that turn into a meeting. */
export const REPLY_RATE = 0.25;
export const MEETING_FROM_REPLY = 0.4;
/** Units that count as published content. */
const CONTENT_UNITS = ["פוסט", "סרטון"];

/** A plan lives inside one calendar year: from `start` to `end` month (default the whole year). */
export const yearSettings = (S: PlanSettings): PlanSettings => {
  const start = Math.min(Math.max(Math.round(+S.start || 0), 0), 11);
  return { ...S, start, end: Math.min(Math.max(Math.round(S.end ?? 11), start), 11) };
};
/** First day of the plan's first month. */
export const planStartOf = (S: PlanSettings, year: number) => new Date(year, yearSettings(S).start, 1);

export function yearPlan(S: PlanSettings, year: number, k = 1): Plan {
  return buildPlan(buildParams(yearSettings(S), planStartOf(S, year)), k);
}

export interface ChannelTarget { name: string; unit: string; perWeek: number }

export interface WeeklyTargets {
  year: number;
  /** Income the year is meant to bring in, and the plan's share for the current month. */
  yearIncome: number;
  monthIncome: number;
  /** Per week, for the current month of the plan. */
  leads: number;
  meetings: number;
  /** New clients (signed agreements) per week; the file goes to the bank right after. */
  cases: number;
  /** Content pieces (posts + videos) per week. */
  content: number;
  /** Partner meetings per week, and the messages that take. */
  partnerMeetings: number;
  outreach: number;
  channels: ChannelTarget[];
  /** Working hours the plan needs per week. */
  hours: number;
}

/** The weekly numbers the plan asks for in the month that contains `today` (YYYY-MM-DD). */
export function weeklyTargets(S: PlanSettings, year: number, today: string): WeeklyTargets {
  const P = yearPlan(S, year);
  const { start, end } = yearSettings(S);
  const y = Number(today.slice(0, 4));
  const cal = y === year ? Number(today.slice(5, 7)) - 1 : y < year ? start : 11;
  // The month of the plan that today falls in (before it starts: the first; after it ends: the last).
  const m = Math.min(Math.max(cal, start), end as number) - start;
  const weeksInMonth = dim(year, m + start) / 7;
  const wk = (a: number[]) => a[m] / weeksInMonth;
  const channels: ChannelTarget[] = P.chans.map((c) => ({ name: c.n, unit: c.unit, perWeek: c.units / P.weeks }));
  const partnerMeetings = channels.filter((c) => c.name.includes("שותפו")).reduce((a, c) => a + c.perWeek, 0);
  const content = channels.filter((c) => CONTENT_UNITS.includes(c.unit)).reduce((a, c) => a + c.perWeek, 0);
  return {
    year,
    yearIncome: S.target,
    monthIncome: P.tot.income[m],
    leads: wk(P.tot.leads),
    meetings: wk(P.tot.meet),
    cases: wk(P.tot.signed),
    content,
    partnerMeetings,
    outreach: partnerMeetings / (REPLY_RATE * MEETING_FROM_REPLY),
    channels,
    hours: P.wk.total,
  };
}

/** "What it takes" for the year, in plain numbers, for the top of the plan screen. */
export function yearNeeds(S: PlanSettings, year: number) {
  const P = yearPlan(S, year);
  const w = weeklyTargets(S, year, `${year}-${String(yearSettings(S).start + 1).padStart(2, "0")}-15`);
  const { start, end } = yearSettings(S);
  return {
    weeks: P.weeks,
    from: start,
    to: end as number,
    target: S.target,
    cases: P.cases,
    avgFee: P.avgFee,
    leads: P.leads,
    meetings: P.meet,
    content: w.content * P.weeks,
    outreach: w.outreach * P.weeks,
    hoursPerWeek: P.wk.total,
    availableHours: S.hours,
    net: P.net,
  };
}

/** Frozen result of a year: plan vs actual per month, kept when the year is closed. */
export interface YearSummary {
  year: number;
  target: number;
  income: number;
  months: { plan: number; actual: number }[];
  leads: { plan: number; actual: number };
  meetings: { plan: number; actual: number };
  /** New clients (signed agreements). */
  signed: { plan: number; actual: number };
  costs: number;
  note?: string;
}

export function summarizeYear(S: PlanSettings, year: number, days: Record<string, DayEntry>, expensesActual: number | null): YearSummary {
  const P = yearPlan(S, year);
  const from = yearSettings(S).start;
  const months = Array.from({ length: 12 }, (_, m) => ({ plan: Math.round(P.tot.income[m - from] ?? 0), actual: 0 }));
  let leads = 0, meetings = 0, signed = 0;
  for (const d of Object.values(days)) {
    if (!d.date.startsWith(`${year}-`)) continue;
    months[Number(d.date.slice(5, 7)) - 1].actual += d.cash;
    leads += d.leads; meetings += d.meetings; signed += d.signed;
  }
  return {
    year,
    target: S.target,
    income: months.reduce((a, x) => a + x.actual, 0),
    months,
    leads: { plan: Math.ceil(P.leads), actual: leads },
    meetings: { plan: Math.ceil(P.meet), actual: meetings },
    signed: { plan: Math.ceil(P.cases), actual: signed },
    costs: Math.round(expensesActual ?? P.costs),
  };
}

/** Next year's starting point: last year's assumptions, a fresh (unfinished) plan that opens in the wizard. */
export function nextYearSettings(prev: PlanSettings): PlanSettings {
  const next = structuredClone(prev);
  next.done = false;
  next.start = 0;
  next.end = 11;
  // Cost items dated in the past stay valid; their dates are absolute (month + year).
  return next;
}

export interface GoalRow { key: string; label: string; done: number; target: number; href: string }

/** This week's actuals against what the plan asks, as rows for the day and progress screens. */
export function weekGoalRows(t: WeeklyTargets, w: { messages: number; meetings: number; content: number; leads: number }): GoalRow[] {
  const want = (x: number) => (x > 0 ? Math.max(1, Math.ceil(x - 1e-6)) : 0);
  const rows: GoalRow[] = [
    { key: "outreach", label: "פניות לשותפים", done: w.messages, target: want(t.outreach), href: "/admin/partners" },
    { key: "meetings", label: "פגישות עם שותפים", done: w.meetings, target: want(t.partnerMeetings), href: "/admin/partners" },
    { key: "content", label: "תוכן שמתפרסם", done: w.content, target: want(t.content), href: "/admin/content" },
    { key: "leads", label: "לידים חדשים", done: w.leads, target: want(t.leads), href: "/admin/leads" },
  ];
  return rows.filter((r) => r.target > 0);
}

/** One thing the plan asks for this week, turned into today's share of work. */
export interface Quota {
  key: string;
  title: string;
  sub: string;
  href: string;
  goal: "revenue" | "growth" | "exposure" | "admin";
  est: number;
  money: number;
  urgent: boolean;
}

// Per unit: minutes it takes, how close it is to money, and the sentence that tells him what to do.
const QUOTA_META: Record<string, { goal: Quota["goal"]; minutes: number; money: number; verb: (n: number) => string }> = {
  outreach: { goal: "growth", minutes: 4, money: 45, verb: (n) => `לשלוח ${n} פניות לשותפים` },
  meetings: { goal: "growth", minutes: 45, money: 60, verb: (n) => `לקיים ${n === 1 ? "פגישה" : `${n} פגישות`} עם שותפים` },
  content: { goal: "exposure", minutes: 40, money: 20, verb: (n) => `לפרסם ${n === 1 ? "תוכן אחד" : `${n} תכנים`}` },
  leads: { goal: "revenue", minutes: 30, money: 65, verb: (n) => n === 1 ? "לייצר ליד חדש אחד" : `לייצר ${n} לידים חדשים` },
};

/**
 * Today's share of the weekly goals. The week's remaining work is spread over the working days that
 * are left (Sunday to Thursday), so a goal of 14 messages asks for about 3 a day, a goal of one meeting
 * shows up only when the week is half gone, and whatever is left on the last day becomes urgent.
 */
export function dailyQuotas(rows: GoalRow[], date: string): Quota[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday > 4) return [];
  const daysLeft = 5 - weekday;
  const out: Quota[] = [];
  for (const r of rows) {
    const meta = QUOTA_META[r.key];
    const remaining = r.target - r.done;
    if (!meta || remaining <= 0) continue;
    const afterToday = (r.target * (daysLeft - 1)) / 5;
    const n = Math.round(remaining - afterToday);
    if (n <= 0) continue;
    out.push({
      key: r.key,
      title: meta.verb(n),
      sub: `יעד השבוע מהתוכנית: ${r.target} · נעשה עד עכשיו ${r.done}`,
      href: r.href,
      goal: meta.goal,
      est: Math.min(Math.max(10, n * meta.minutes), 120),
      money: meta.money,
      urgent: daysLeft === 1,
    });
  }
  return out;
}
