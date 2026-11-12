import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/drizzle/schema";

// Database operations for manual tasks. They take the user id explicitly so they can be
// exercised against a test database.

export type TaskRecord = typeof tasks.$inferSelect;

export async function createTask(
  userId: string,
  input: { title: string; dueAt?: string | null; important?: boolean; estMinutes?: number; goal?: string }
): Promise<TaskRecord> {
  const [row] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      dueAt: input.dueAt ?? null,
      important: input.important ?? false,
      estMinutes: input.estMinutes ?? 15,
      goal: input.goal ?? "admin",
    })
    .returning();
  return row;
}

export interface TaskPatch {
  title?: string;
  dueAt?: string | null;
  important?: boolean;
  estMinutes?: number;
  goal?: string;
  quadrantOverride?: number | null;
  status?: "open" | "done" | "dropped";
  notes?: string;
}

export async function updateTask(userId: string, id: string, patch: TaskPatch): Promise<TaskRecord | null> {
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.dueAt !== undefined) set.dueAt = patch.dueAt;
  if (patch.important !== undefined) set.important = patch.important;
  if (patch.estMinutes !== undefined) set.estMinutes = patch.estMinutes;
  if (patch.goal !== undefined) set.goal = patch.goal;
  if (patch.quadrantOverride !== undefined) set.quadrantOverride = patch.quadrantOverride;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.status !== undefined) {
    set.status = patch.status;
    set.doneAt = patch.status === "done" ? new Date() : null;
  }
  const [row] = await db.update(tasks).set(set).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning();
  return row ?? null;
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning({ id: tasks.id });
  return rows.length > 0;
}
