"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { taskInputSchema, taskPatchSchema } from "@/lib/tasks";
import { createTask, deleteTask, updateTask } from "@/lib/tasks-db";

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
