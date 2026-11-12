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

export type TaskSource = "partner" | "client" | "content" | "lead" | "manual";

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
  urgent: boolean;
  important: boolean;
  quadrant: Quadrant;
  due: string | null;
  late: boolean;
}

export interface PriorityInput {
  partners: { id: string; name: string; kind: string; stage: string; wave: string | null; priority: string | null; nextAt: string | null; nextAction: string | null; archived: boolean }[];
  clients: { id: string; name: string; process: string; stageIndex: number; stageDueAt: string | null; status: string; pendingMessage: string | null }[];
  content: { id: string; title: string; format: string; status: string; plannedAt: string | null; publishedAt: string | null; hasMetrics: boolean }[];
  leads: { id: string; name: string; stage: string; nextAt: string | null; nextStep: string | null }[];
  manual: { id: string; title: string; dueAt: string | null; important: boolean; estMinutes: number; goal: string; quadrantOverride: number | null; status: string }[];
}

export const quadrantOf = (urgent: boolean, important: boolean): Quadrant =>
  urgent && important ? 1 : important ? 2 : urgent ? 3 : 4;

const CONTENT_MINUTES: Record<string, number> = { post: 30, reel: 45, story: 10, carousel: 45, video: 60, podcast: 90, other: 30 };
const HOT_PARTNER_STAGES = ["replied", "meeting", "met", "coupon"];

export function buildPriorityTasks(input: PriorityInput, today: string): PriorityTask[] {
  const out: PriorityTask[] = [];
  const add = (t: Omit<PriorityTask, "quadrant" | "late"> & { late?: boolean; quadrant?: Quadrant }) =>
    out.push({ ...t, late: t.late ?? false, quadrant: t.quadrant ?? quadrantOf(t.urgent, t.important) });

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
      urgent: d <= 0, important, due: p.nextAt, late: d < 0,
    });
  }

  for (const c of input.clients) {
    if (c.status !== "active") continue;
    const stage = stageOf(c.process, c.stageIndex);
    const base = { source: "client" as const, id: c.id, href: `/admin/clients?open=${c.id}`, goal: "revenue" as const, important: true };
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
        href: `/admin/content?open=${k.id}`, goal: "exposure", est: CONTENT_MINUTES[k.format] ?? 30,
        urgent: d <= 0, important: true, due: k.plannedAt, late: d < 0,
      });
    } else if (k.status === "published" && k.publishedAt && !k.hasMetrics) {
      const age = diffDays(today, k.publishedAt);
      if (age >= 1 && age <= 7) {
        add({
          key: `m:${k.id}`, source: "content", id: k.id, title: `ביצועים: ${k.title}`, sub: "להעלות צילום ביצועים",
          href: `/admin/content?open=${k.id}`, goal: "exposure", est: 5, urgent: false, important: true, due: null,
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
      goal: "revenue", est: 10, urgent: d <= 0, important: true, due: l.nextAt, late: d < 0,
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
      est: m.estMinutes, urgent: ov ? ov === 1 || ov === 3 : urgent, important: ov ? ov === 1 || ov === 2 : m.important,
      due: m.dueAt, late: !!m.dueAt && diffDays(m.dueAt, today) < 0, quadrant: ov,
    });
  }

  const dueKey = (t: PriorityTask) => t.due ?? "9999-12-31";
  return out.sort((a, b) => a.quadrant - b.quadrant || dueKey(a).localeCompare(dueKey(b)) || a.title.localeCompare(b.title, "he"));
}

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
  manual: { 1: "משימות דחופות", 2: "משימות חשובות", 3: "משימות קטנות" },
};

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

export function planDay(tasks: PriorityTask[], cursor: number = WORK.start): DayPlan {
  const blocks: Block[] = [];
  const overflow: PriorityTask[] = [];
  let at = cursor;

  const place = (title: string, items: PriorityTask[], quadrant: Quadrant, force: boolean) => {
    if (!items.length) return;
    const minutes = Math.max(10, roundUp(items.reduce((s, t) => s + t.est, 0), 5));
    let start = at;
    // A block that would run into lunch starts after it instead.
    if (start < WORK.lunchEnd && start + minutes > WORK.lunchStart) start = Math.max(start, WORK.lunchEnd);
    const end = start + minutes;
    if (end > WORK.end && !force) {
      overflow.push(...items);
      return;
    }
    blocks.push({ start, end, title, quadrant, goal: items[0].goal, keys: items.map((t) => t.key), overtime: end > WORK.end || undefined });
    at = end;
  };

  const bySource = (q: Quadrant) => {
    const groups = new Map<TaskSource, PriorityTask[]>();
    for (const t of tasks.filter((x) => x.quadrant === q)) groups.set(t.source, [...(groups.get(t.source) ?? []), t]);
    return groups;
  };

  // 1. Urgent and important: first, always placed.
  for (const src of ["client", "lead", "partner", "content", "manual"] as TaskSource[]) {
    place(GROUP_TITLE[src][1], bySource(1).get(src) ?? [], 1, true);
  }
  // 2. Important, not urgent: the deep work (content) first, then outreach, in the best hours.
  const q2 = bySource(2);
  for (const t of q2.get("content") ?? []) place(`${GROUP_TITLE.content[2]}: ${t.title}`, [t], 2, false);
  for (const src of ["client", "lead", "partner", "manual"] as TaskSource[]) place(GROUP_TITLE[src][2], q2.get(src) ?? [], 2, false);
  // 3. Urgent, not important: one batch at the end.
  const q3 = tasks.filter((t) => t.quadrant === 3);
  place("משימות קטנות בקבוצה", q3, 3, false);

  return { blocks, overflow };
}

export function summarizeGoals(tasks: PriorityTask[]): Record<Goal, number> {
  const out: Record<Goal, number> = { revenue: 0, growth: 0, exposure: 0, admin: 0 };
  for (const t of tasks) if (t.quadrant <= 2) out[t.goal] += t.est;
  return out;
}
