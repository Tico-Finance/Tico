import { daysLate, messageByKey, processOf, stageOf } from "./clients";
import { STAGE_LABELS, addDays, diffDays } from "./partners";

// The day, organised by the Eisenhower matrix: urgent/important decides the quadrant, and the
// day plan puts the quadrants in order on the clock. Everything is derived from the data that
// already exists (partners, clients, content, leads) plus manual tasks.

export type Goal = "revenue" | "growth" | "exposure" | "admin";
export const GOAL_LABELS: Record<Goal, string> = {
  revenue: "הכנסה",
  growth: "שיתופי פעולה",
  exposure: "חשיפה",
  admin: "תחזוקה",
};

export type Quadrant = 1 | 2 | 3 | 4;
export const QUADRANTS: Record<Quadrant, { title: string; hint: string }> = {
  1: { title: "דחוף וחשוב", hint: "עשה עכשיו" },
  2: { title: "חשוב, לא דחוף", hint: "תזמן. כאן העסק גדל" },
  3: { title: "דחוף, לא חשוב", hint: "תעשה בקבוצה" },
  4: { title: "לא דחוף ולא חשוב", hint: "תדחה או תמחק" },
};

export type TaskSource = "partner" | "client" | "content" | "lead" | "manual" | "routine" | "plan";

export interface PriorityTask {
  key: string;
  source: TaskSource;
  id: string;
  title: string;
  sub: string;
  href: string;
  goal: Goal;
  /** Estimated minutes. */
  est: number;
  /** 0-100: how close this is to money coming in (clients and leads highest, admin lowest). */
  money: number;
  /** How many times a manual task was pushed to another day. */
  postponed: number;
  urgent: boolean;
  important: boolean;
  quadrant: Quadrant;
  due: string | null;
  late: boolean;
  /** Routines with a fixed time: minutes from midnight. */
  startMin?: number | null;
}

export interface PriorityInput {
  partners: { id: string; name: string; kind: string; stage: string; wave: string | null; priority: string | null; nextAt: string | null; nextAction: string | null; archived: boolean }[];
  clients: { id: string; name: string; process: string; stageIndex: number; stageDueAt: string | null; status: string; pendingMessage: string | null }[];
  content: { id: string; title: string; format: string; status: string; plannedAt: string | null; publishedAt: string | null; hasMetrics: boolean }[];
  leads: { id: string; name: string; stage: string; nextAt: string | null; nextStep: string | null }[];
  /** Today's share of the weekly goals from the yearly plan. */
  quotas?: { key: string; title: string; sub: string; href: string; goal: string; est: number; money: number; urgent: boolean }[];
  routines?: { id: string; title: string; date: string; startMin: number | null; estMinutes: number; goal: string; flexible: boolean; late: boolean }[];
  manual: { id: string; title: string; dueAt: string | null; important: boolean; estMinutes: number; goal: string; quadrantOverride: number | null; status: string; postponed?: number }[];
}

export const quadrantOf = (urgent: boolean, important: boolean): Quadrant =>
  urgent && important ? 1 : important ? 2 : urgent ? 3 : 4;

const CONTENT_MINUTES: Record<string, number> = { post: 30, reel: 45, story: 10, carousel: 45, video: 60, podcast: 90, other: 30 };
const HOT_PARTNER_STAGES = ["replied", "meeting", "met", "coupon"];
const MANUAL_MONEY: Record<string, number> = { revenue: 80, growth: 40, exposure: 20, admin: 5 };

export function buildPriorityTasks(input: PriorityInput, today: string): PriorityTask[] {
  const out: PriorityTask[] = [];
  const add = (t: Omit<PriorityTask, "quadrant" | "late" | "postponed"> & { late?: boolean; quadrant?: Quadrant; postponed?: number; startMin?: number | null }) =>
    out.push({ ...t, late: t.late ?? false, postponed: t.postponed ?? 0, quadrant: t.quadrant ?? quadrantOf(t.urgent, t.important) });

  for (const p of input.partners) {
    if (p.archived || p.stage === "dead" || !p.nextAt) continue;
    const d = diffDays(p.nextAt, today);
    if (d > 2) continue;
    const important = HOT_PARTNER_STAGES.includes(p.stage) || p.wave === "1" || p.priority === "גבוהה";
    const visit = p.kind !== "broker" && (p.stage === "cold" || p.stage === "quiet");
    add({
      key: `p:${p.id}`, source: "partner", id: p.id, title: p.name,
      sub: p.nextAction || STAGE_LABELS[p.stage as keyof typeof STAGE_LABELS] || "",
      href: `/admin/partners?open=${p.id}`, goal: "growth",
      est: p.stage === "meeting" ? 45 : visit ? 30 : 4,
      money: HOT_PARTNER_STAGES.includes(p.stage) ? 85 : p.wave === "1" || p.priority === "גבוהה" ? 45 : 30,
      urgent: d <= 0, important, due: p.nextAt, late: d < 0,
    });
  }

  for (const c of input.clients) {
    if (c.status !== "active") continue;
    const stage = stageOf(c.process, c.stageIndex);
    const base = { source: "client" as const, id: c.id, href: `/admin/clients?open=${c.id}`, goal: "revenue" as const, important: true, money: 100 };
    if (c.pendingMessage) {
      add({ ...base, key: `c:${c.id}`, title: `עדכון ללקוח: ${c.name}`, sub: messageByKey(c.pendingMessage)?.title ?? "הודעה מוכנה", est: 5, urgent: true, due: today });
      continue;
    }
    const late = daysLate(c.stageDueAt, today);
    const label = `${processOf(c.process).label} · ${stage?.label ?? ""}`;
    if (late > 0) {
      add({ ...base, key: `c:${c.id}`, title: `${c.name} בעיכוב ${late} י׳`, sub: label, est: 15, urgent: true, due: c.stageDueAt, late: true });
    } else if (c.stageDueAt && diffDays(c.stageDueAt, today) <= 2) {
      const d = diffDays(c.stageDueAt, today);
      add({ ...base, key: `c:${c.id}`, title: `${c.name}: סיום שלב ${d === 0 ? "היום" : "בקרוב"}`, sub: label, est: 15, urgent: d <= 0, due: c.stageDueAt });
    }
  }

  for (const k of input.content) {
    if (k.status === "planned" && k.plannedAt) {
      const d = diffDays(k.plannedAt, today);
      if (d > 3) continue;
      add({
        key: `k:${k.id}`, source: "content", id: k.id, title: k.title,
        sub: d < 0 ? "היה מתוכנן לפני" + ` ${-d} י׳` : d === 0 ? "מתוכנן להיום" : "מתוכנן בקרוב",
        href: `/admin/content?open=${k.id}`, goal: "exposure", est: CONTENT_MINUTES[k.format] ?? 30, money: 20,
        urgent: d <= 0, important: true, due: k.plannedAt, late: d < 0,
      });
    } else if (k.status === "published" && k.publishedAt && !k.hasMetrics) {
      const age = diffDays(today, k.publishedAt);
      if (age >= 1 && age <= 7) {
        add({
          key: `m:${k.id}`, source: "content", id: k.id, title: `ביצועים: ${k.title}`, sub: "להעלות צילום ביצועים",
          href: `/admin/content?open=${k.id}`, goal: "exposure", est: 5, money: 10, urgent: false, important: true, due: null,
        });
      }
    }
  }

  for (const l of input.leads) {
    if (l.stage === "client" || l.stage === "lost" || !l.nextAt) continue;
    const d = diffDays(l.nextAt, today);
    if (d > 2) continue;
    add({
      key: `l:${l.id}`, source: "lead", id: l.id, title: l.name, sub: l.nextStep || "ליד לטיפול", href: "/admin/leads",
      goal: "revenue", est: 10, money: l.stage === "meeting" || l.stage === "conversation" ? 90 : 70,
      urgent: d <= 0, important: true, due: l.nextAt, late: d < 0,
    });
  }

  for (const m of input.manual) {
    if (m.status !== "open") continue;
    const urgent = !!m.dueAt && diffDays(m.dueAt, today) <= 0;
    const ov = m.quadrantOverride && m.quadrantOverride >= 1 && m.quadrantOverride <= 4 ? (m.quadrantOverride as Quadrant) : undefined;
    add({
      key: `t:${m.id}`, source: "manual", id: m.id, title: m.title,
      sub: m.dueAt ? (urgent ? "משימה ידנית · להיום או באיחור" : "משימה ידנית") : "משימה ידנית",
      href: "/admin/home", goal: (["revenue", "growth", "exposure", "admin"].includes(m.goal) ? m.goal : "admin") as Goal,
      est: m.estMinutes, money: MANUAL_MONEY[m.goal] ?? 5, postponed: m.postponed ?? 0,
      urgent: ov ? ov === 1 || ov === 3 : urgent, important: ov ? ov === 1 || ov === 2 : m.important,
      due: m.dueAt, late: !!m.dueAt && diffDays(m.dueAt, today) < 0, quadrant: ov,
    });
  }

  // The yearly plan, as today's share of the week's goals (messages, meetings, content, leads).
  for (const q of input.quotas ?? []) {
    const goal = (["revenue", "growth", "exposure", "admin"].includes(q.goal) ? q.goal : "admin") as Goal;
    add({
      key: `q:${q.key}:${today}`, source: "plan", id: q.key, title: q.title, sub: q.sub, href: q.href,
      goal, est: q.est, money: q.money, urgent: q.urgent, important: true, due: today, late: false,
    });
  }

  // Weekly routines: on their day they are important; unless flexible they are also urgent.
  for (const r of input.routines ?? []) {
    const goal = (["revenue", "growth", "exposure", "admin"].includes(r.goal) ? r.goal : "admin") as Goal;
    add({
      key: `r:${r.id}:${r.date}`, source: "routine", id: r.id, title: r.title,
      sub: r.late ? "הרגל קבוע · לא סומן בימים האחרונים" : r.startMin !== null ? `הרגל קבוע · ${hhmm(r.startMin)}` : "הרגל קבוע",
      href: "/admin/routines", goal, est: r.estMinutes, money: MANUAL_MONEY[goal] ?? 5,
      urgent: !r.flexible || r.late, important: true, due: r.date, late: r.late, startMin: r.late ? null : r.startMin,
    });
  }

  const dueKey = (t: PriorityTask) => t.due ?? "9999-12-31";
  return out.sort((a, b) => a.quadrant - b.quadrant || dueKey(a).localeCompare(dueKey(b)) || a.title.localeCompare(b.title, "he"));
}

// ── Focus: what to do first ──

/** Higher is more worth doing now: urgent and important first, then the closest to money. */
export function focusScore(t: PriorityTask): number {
  const base = t.quadrant === 1 ? 400 : t.quadrant === 2 ? 200 : t.quadrant === 3 ? 20 : 0;
  return base + t.money * 3 + (t.late ? 100 : 0) + Math.min(t.postponed, 2) * 15;
}

/** The tasks worth the day's first attention, best first. Quadrant 4 never appears. */
export function rankForFocus(tasks: PriorityTask[], limit = 8): PriorityTask[] {
  return tasks
    .filter((t) => t.quadrant <= 3)
    .sort((a, b) => focusScore(b) - focusScore(a) || a.est - b.est)
    .slice(0, limit);
}

/** Money-first: the few actions closest to income, protected at the start of the day. */
export const MONEY_FIRST_MIN_SCORE = 70;
export const MONEY_FIRST_MAX_TASKS = 3;

// ── Working days and the clock (Israel) ──

export const WORK = { start: 9 * 60, end: 17 * 60, lunchStart: 13 * 60, lunchEnd: 13 * 60 + 30, days: [0, 1, 2, 3, 4] } as const; // Sun-Thu

export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const isWorkday = (date: string) => (WORK.days as readonly number[]).includes(weekdayOf(date));

export function nextWorkday(date: string): string {
  let d = addDays(date, 1);
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
}

export function nowIL(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Which day the plan is for: today while there is working time left, otherwise the next working day. */
export function dayToPlan(now: { date: string; minutes: number }): { date: string; isToday: boolean; cursor: number } {
  if (isWorkday(now.date) && now.minutes < WORK.end - 30) {
    return { date: now.date, isToday: true, cursor: Math.max(WORK.start, Math.ceil(now.minutes / 15) * 15) };
  }
  return { date: nextWorkday(now.date), isToday: false, cursor: WORK.start };
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ── The day plan ──

export interface Block {
  start: number;
  end: number;
  title: string;
  quadrant: Quadrant;
  goal: Goal;
  keys: string[];
  /** Q1 work that runs past the end of the working day. */
  overtime?: boolean;
  /** A fixed calendar event rather than planned work. */
  calendar?: boolean;
}

export interface DayPlan {
  blocks: Block[];
  /** Tasks that did not fit in the working day; they belong to the next one. */
  overflow: PriorityTask[];
}

const GROUP_TITLE: Record<TaskSource, Record<1 | 2 | 3, string>> = {
  client: { 1: "לקוחות: עדכונים ועיכובים", 2: "לקוחות: לקדם שלבים", 3: "לקוחות: משימות קטנות" },
  partner: { 1: "שותפים: פניות להיום", 2: "שותפים: פניות וביקורים", 3: "שותפים: משימות קטנות" },
  lead: { 1: "לידים לטיפול", 2: "לידים לטיפול", 3: "לידים: משימות קטנות" },
  content: { 1: "תוכן: להעלות היום", 2: "תוכן", 3: "תוכן: משימות קטנות" },
  plan: { 1: "יעדי השבוע מהתוכנית", 2: "יעדי השבוע מהתוכנית", 3: "יעדי השבוע מהתוכנית" },
  routine: { 1: "הרגלים קבועים", 2: "הרגלים קבועים", 3: "הרגלים קבועים" },
  manual: { 1: "משימות דחופות", 2: "משימות חשובות", 3: "משימות קטנות" },
};

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/** Something already fixed in the calendar (minutes from midnight) that the plan works around. */
export interface Busy { start: number; end: number; title: string }

export function planDay(tasks: PriorityTask[], cursor: number = WORK.start, busy: Busy[] = []): DayPlan {
  const blocks: Block[] = [];
  const overflow: PriorityTask[] = [];
  let at = cursor;

  // Routines with a fixed time are pinned first; everything else is planned around them.
  const pinned = tasks.filter((t) => t.source === "routine" && t.startMin != null);
  const fixed = pinned.map((t) => ({ start: t.startMin as number, end: (t.startMin as number) + t.est }));
  for (const t of pinned) {
    const start = t.startMin as number;
    blocks.push({ start, end: start + t.est, title: t.title, quadrant: t.quadrant, goal: t.goal, keys: [t.key], overtime: start + t.est > WORK.end || undefined });
  }
  // A calendar event that overlaps a pinned routine is usually the same thing (the recording in both), so it is not drawn twice.
  for (const b of busy.filter((x) => !fixed.some((f) => x.start < f.end && x.end > f.start))) {
    fixed.push({ start: b.start, end: b.end });
    blocks.push({ start: b.start, end: b.end, title: `ביומן: ${b.title}`, quadrant: 1, goal: "revenue", keys: [], calendar: true });
  }
  tasks = tasks.filter((t) => !pinned.includes(t));
  // Moves a slot past any fixed block it would overlap.
  const clear = (start: number, minutes: number) => {
    for (let i = 0; i <= fixed.length; i++) {
      const hit = fixed.find((f) => start < f.end && start + minutes > f.start);
      if (!hit) break;
      start = hit.end;
    }
    return start;
  };

  const place = (title: string, items: PriorityTask[], quadrant: Quadrant, force: boolean) => {
    if (!items.length) return;
    const minutes = Math.max(10, roundUp(items.reduce((s, t) => s + t.est, 0), 5));
    let start = clear(at, minutes);
    // A block that would run into lunch starts after it instead.
    if (start < WORK.lunchEnd && start + minutes > WORK.lunchStart) start = clear(Math.max(start, WORK.lunchEnd), minutes);
    const end = start + minutes;
    if (end > WORK.end && !force) {
      overflow.push(...items);
      return;
    }
    blocks.push({ start, end, title, quadrant, goal: items[0].goal, keys: items.map((t) => t.key), overtime: end > WORK.end || undefined });
    at = end;
  };

  // 0. Money first: the actions closest to income (clients, leads, warm partners, money tasks), before anything else.
  const moneyFirst = tasks
    .filter((t) => t.quadrant <= 2 && t.money >= MONEY_FIRST_MIN_SCORE)
    .sort((a, b) => b.money - a.money || a.quadrant - b.quadrant || a.est - b.est)
    .slice(0, MONEY_FIRST_MAX_TASKS);
  const moneyKeys = new Set(moneyFirst.map((t) => t.key));
  if (moneyFirst.length) {
    place("כסף קודם: מה שמקרב הכנסה", moneyFirst, moneyFirst.some((t) => t.quadrant === 1) ? 1 : 2, true);
  }
  const rest = tasks.filter((t) => !moneyKeys.has(t.key));
  const bySource = (q: Quadrant) => {
    const groups = new Map<TaskSource, PriorityTask[]>();
    for (const t of rest.filter((x) => x.quadrant === q)) groups.set(t.source, [...(groups.get(t.source) ?? []), t]);
    return groups;
  };

  // 1. Urgent and important: first, always placed.
  for (const src of ["client", "lead", "partner", "content", "routine", "plan", "manual"] as TaskSource[]) {
    place(GROUP_TITLE[src][1], bySource(1).get(src) ?? [], 1, true);
  }
  // 2. Important, not urgent: the deep work (content) first, then outreach, in the best hours.
  const q2 = bySource(2);
  for (const t of q2.get("content") ?? []) place(`${GROUP_TITLE.content[2]}: ${t.title}`, [t], 2, false);
  for (const src of ["client", "lead", "partner", "routine", "plan", "manual"] as TaskSource[]) place(GROUP_TITLE[src][2], q2.get(src) ?? [], 2, false);
  // 3. Urgent, not important: one batch at the end.
  const q3 = rest.filter((t) => t.quadrant === 3);
  place("משימות קטנות בקבוצה", q3, 3, false);

  blocks.sort((a, b) => a.start - b.start);
  return { blocks, overflow };
}

export function summarizeGoals(tasks: PriorityTask[]): Record<Goal, number> {
  const out: Record<Goal, number> = { revenue: 0, growth: 0, exposure: 0, admin: 0 };
  for (const t of tasks) if (t.quadrant <= 2) out[t.goal] += t.est;
  return out;
}
