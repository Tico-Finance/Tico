import { z } from "zod";
import { addDays } from "./partners";

// Weekly routines: the fixed rhythm of the business (record the podcast on Tuesday, edit, publish).
// Each one shows up on its weekdays in the day plan and stays visible until it is marked done or
// skipped, so nothing quietly falls through.

export const WEEKDAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;
/** A missed routine stays on the list this many days back. */
export const LOOKBACK_DAYS = 3;

export const routineInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startMin: z.number().int().min(0).max(1439).nullable().optional(),
  estMinutes: z.number().int().min(5).max(600).default(30),
  goal: z.enum(["revenue", "growth", "exposure", "admin"]).default("exposure"),
  flexible: z.boolean().default(false),
  active: z.boolean().optional(),
});
export type RoutineInput = z.infer<typeof routineInputSchema>;

export interface RoutineRow {
  id: string;
  title: string;
  weekdays: number[];
  startMin: number | null;
  estMinutes: number;
  goal: string;
  flexible: boolean;
  active: boolean;
}
export interface RoutineLog { routineId: string; date: string; status: string }

/** Sunday = 0 for a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export interface Occurrence { routine: RoutineRow; date: string; late: boolean }

/** Routines that are due today, plus those missed in the last days and not yet marked. */
export function dueOccurrences(routines: RoutineRow[], logs: RoutineLog[], today: string): Occurrence[] {
  const logged = new Set(logs.map((l) => `${l.routineId}|${l.date}`));
  const out: Occurrence[] = [];
  for (const r of routines) {
    if (!r.active) continue;
    for (let back = LOOKBACK_DAYS; back >= 0; back--) {
      const date = addDays(today, -back);
      if (r.weekdays.includes(weekdayOf(date)) && !logged.has(`${r.id}|${date}`)) out.push({ routine: r, date, late: back > 0 });
    }
  }
  return out;
}

export interface WeekCell { date: string; due: boolean; status: "done" | "skipped" | "missed" | "pending" | null }

/** One row per routine for the week starting at `weekStart` (Sunday): done, skipped, missed or still ahead. */
export function weekGrid(routines: RoutineRow[], logs: RoutineLog[], weekStart: string, today: string): { routine: RoutineRow; cells: WeekCell[] }[] {
  const by = new Map(logs.map((l) => [`${l.routineId}|${l.date}`, l.status]));
  return routines.filter((r) => r.active).map((routine) => ({
    routine,
    cells: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const due = routine.weekdays.includes(i);
      if (!due) return { date, due, status: null };
      const s = by.get(`${routine.id}|${date}`);
      const status: WeekCell["status"] = s === "done" ? "done" : s === "skipped" ? "skipped" : date < today ? "missed" : "pending";
      return { date, due, status };
    }),
  }));
}

/** The routines Chico described, as editable starting points. */
export const STARTER_ROUTINES: RoutineInput[] = [
  { title: "הקלטת פודקאסט", weekdays: [2], startMin: 10 * 60 + 30, estMinutes: 90, goal: "exposure", flexible: false },
  { title: "עריכת הפרק", weekdays: [3], estMinutes: 120, goal: "exposure", flexible: false },
  { title: "עריכת סרטונים קצרים", weekdays: [4], estMinutes: 90, goal: "exposure", flexible: true },
  { title: "פרסום שבועי מתוזמן", weekdays: [0], estMinutes: 30, goal: "exposure", flexible: false },
];
