import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { routineLogs, routines } from "@/drizzle/schema";
import type { RoutineInput, RoutineLog, RoutineRow } from "@/lib/routines";

const toRow = (r: typeof routines.$inferSelect): RoutineRow => ({
  id: r.id, title: r.title, weekdays: r.weekdays, startMin: r.startMin, estMinutes: r.estMinutes, goal: r.goal, flexible: r.flexible, active: r.active,
});

export async function listRoutines(userId: string): Promise<RoutineRow[]> {
  const rows = await db.select().from(routines).where(eq(routines.userId, userId)).orderBy(asc(routines.createdAt));
  return rows.map(toRow);
}

export async function loadRoutineLogs(userId: string, since: string): Promise<RoutineLog[]> {
  const rows = await db.select().from(routineLogs).where(and(eq(routineLogs.userId, userId), gte(routineLogs.date, since)));
  return rows.map((l) => ({ routineId: l.routineId, date: l.date, status: l.status }));
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<RoutineRow> {
  const [row] = await db.insert(routines).values({
    userId, title: input.title, weekdays: [...new Set(input.weekdays)].sort(), startMin: input.startMin ?? null,
    estMinutes: input.estMinutes, goal: input.goal, flexible: input.flexible, active: input.active ?? true,
  }).returning();
  return toRow(row);
}

export async function updateRoutine(userId: string, id: string, input: Partial<RoutineInput>): Promise<boolean> {
  const set: Partial<typeof routines.$inferInsert> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.weekdays !== undefined) set.weekdays = [...new Set(input.weekdays)].sort();
  if (input.startMin !== undefined) set.startMin = input.startMin;
  if (input.estMinutes !== undefined) set.estMinutes = input.estMinutes;
  if (input.goal !== undefined) set.goal = input.goal;
  if (input.flexible !== undefined) set.flexible = input.flexible;
  if (input.active !== undefined) set.active = input.active;
  if (Object.keys(set).length === 0) return true;
  const rows = await db.update(routines).set(set).where(and(eq(routines.id, id), eq(routines.userId, userId))).returning({ id: routines.id });
  return rows.length > 0;
}

export async function deleteRoutine(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(routines).where(and(eq(routines.id, id), eq(routines.userId, userId))).returning({ id: routines.id });
  return rows.length > 0;
}

/** Mark a routine's day done or skipped; `null` removes the mark (undo). */
export async function logRoutine(userId: string, routineId: string, date: string, status: "done" | "skipped" | null): Promise<boolean> {
  const [own] = await db.select({ id: routines.id }).from(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId))).limit(1);
  if (!own) return false;
  if (status === null) {
    await db.delete(routineLogs).where(and(eq(routineLogs.routineId, routineId), eq(routineLogs.date, date)));
    return true;
  }
  await db.insert(routineLogs).values({ userId, routineId, date, status })
    .onConflictDoUpdate({ target: [routineLogs.routineId, routineLogs.date], set: { status, createdAt: new Date() } });
  return true;
}
