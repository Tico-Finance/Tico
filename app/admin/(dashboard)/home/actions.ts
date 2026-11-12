"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { taskInputSchema, taskPatchSchema } from "@/lib/tasks";
import { logRoutine } from "@/lib/routines-db";
import { createTask, deleteTask, postponeTask, updateTask } from "@/lib/tasks-db";

type Result = { ok: true } | { ok: false; error: string };

export async function createTaskAction(input: unknown): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = taskInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  await createTask(userId, p.data);
  revalidatePath("/admin/home");
  return { ok: true };
}

export async function updateTaskAction(id: string, patch: unknown): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = taskPatchSchema.safeParse(patch);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const row = await updateTask(userId, id, p.data);
  if (!row) return { ok: false, error: "לא נמצא" };
  revalidatePath("/admin/home");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!(await deleteTask(userId, id))) return { ok: false, error: "לא נמצא" };
  revalidatePath("/admin/home");
  return { ok: true };
}

/** Move a manual task to another day (counted, so avoided tasks stand out). */
export async function postponeTaskAction(id: string, dueAt: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return { ok: false, error: "תאריך לא תקין" };
  if (!(await postponeTask(userId, id, dueAt))) return { ok: false, error: "לא נמצא" };
  revalidatePath("/admin/home");
  return { ok: true };
}

/** Mark a routine's day done or skipped (null undoes it). */
export async function logRoutineAction(routineId: string, date: string, status: "done" | "skipped" | null): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "תאריך לא תקין" };
  if (!(await logRoutine(userId, routineId, date, status))) return { ok: false, error: "לא נמצא" };
  revalidatePath("/admin/home");
  revalidatePath("/admin/routines");
  return { ok: true };
}
