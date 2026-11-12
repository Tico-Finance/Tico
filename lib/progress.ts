import { SENT_EVENT_KINDS, addDays, todayIL } from "./partners";

// Weekly progress: every action that moves the business is worth points, grouped by how close
// it is to money. Weeks run Sunday to Saturday (Israel time).

export const weekStartOf = (date: string) => addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay());

export interface WeekStats {
  /** Sunday of the week (YYYY-MM-DD). */
  start: string;
  messages: number;
  replies: number;
  meetings: number;
  stages: number;
  clientsDone: number;
  content: number;
  leads: number;
  tasksDone: number;
  /** Points close to money: client progress, closed files, new leads, revenue tasks. */
  direct: number;
  /** Points for building the pipeline: messages, replies, partner meetings. */
  pipeline: number;
  exposure: number;
  maintenance: number;
  total: number;
  /** Share of the points that are direct, 0-100, or null when the week is empty. */
  moneyShare: number | null;
}

export interface ProgressInput {
  partnerEvents: { kind: string; at: Date }[];
  clientEvents: { kind: string; text: string; at: Date }[];
  content: { publishedAt: string | null }[];
  leads: { createdAt: Date }[];
  tasks: { doneAt: Date | null; goal: string }[];
}

const POINTS = { stage: 3, clientDone: 10, lead: 2, revenueTask: 2, message: 1, reply: 3, meeting: 5, growthTask: 1, content: 3, exposureTask: 1, adminTask: 1 };

/** The weeks ending with the one that contains `today`, oldest first. */
export function buildProgress(input: ProgressInput, today: string, weeks = 8): WeekStats[] {
  const first = addDays(weekStartOf(today), -7 * (weeks - 1));
  const rows: WeekStats[] = Array.from({ length: weeks }, (_, i) => ({
    start: addDays(first, 7 * i), messages: 0, replies: 0, meetings: 0, stages: 0, clientsDone: 0, content: 0, leads: 0, tasksDone: 0,
    direct: 0, pipeline: 0, exposure: 0, maintenance: 0, total: 0, moneyShare: null,
  }));
  const at = (d: string): WeekStats | undefined => {
    const idx = Math.floor((Date.parse(`${weekStartOf(d)}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / (7 * 86_400_000));
    return rows[idx];
  };

  for (const e of input.partnerEvents) {
    const w = at(todayIL(e.at));
    if (!w) continue;
    if ((SENT_EVENT_KINDS as string[]).includes(e.kind)) { w.messages++; w.pipeline += POINTS.message; }
    else if (e.kind === "replied") { w.replies++; w.pipeline += POINTS.reply; }
    else if (e.kind === "meetingSet" || e.kind === "met") { w.meetings++; w.pipeline += POINTS.meeting; }
  }
  for (const e of input.clientEvents) {
    if (e.kind !== "stage_done") continue;
    const w = at(todayIL(e.at));
    if (!w) continue;
    w.stages++; w.direct += POINTS.stage;
    if (e.text.includes("התהליך הושלם")) { w.clientsDone++; w.direct += POINTS.clientDone; }
  }
  for (const c of input.content) {
    const w = c.publishedAt ? at(c.publishedAt) : undefined;
    if (w) { w.content++; w.exposure += POINTS.content; }
  }
  for (const l of input.leads) {
    const w = at(todayIL(l.createdAt));
    if (w) { w.leads++; w.direct += POINTS.lead; }
  }
  for (const t of input.tasks) {
    const w = t.doneAt ? at(todayIL(t.doneAt)) : undefined;
    if (!w) continue;
    w.tasksDone++;
    if (t.goal === "revenue") w.direct += POINTS.revenueTask;
    else if (t.goal === "growth") w.pipeline += POINTS.growthTask;
    else if (t.goal === "exposure") w.exposure += POINTS.exposureTask;
    else w.maintenance += POINTS.adminTask;
  }
  for (const w of rows) {
    w.total = w.direct + w.pipeline + w.exposure + w.maintenance;
    w.moneyShare = w.total > 0 ? Math.round((w.direct / w.total) * 100) : null;
  }
  return rows;
}

/** Change from the previous week, as a percent, or null when there is nothing to compare to. */
export function deltaPct(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / before) * 100);
}
