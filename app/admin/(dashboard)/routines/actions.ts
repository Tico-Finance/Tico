"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { routineInputSchema } from "@/lib/routines";
import { createRoutine, deleteRoutine, logRoutine, updateRoutine } from "@/lib/routines-db";

type Result = { ok: true } | { ok: false; error: string };

const refresh = () => { revalidatePath("/admin/routines"); revalidatePath("/admin/home"); };

export async function createRoutineAction(input: unknown): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = routineInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  await createRoutine(userId, p.data);
  refresh();
  return { ok: true };
}

export async function updateRoutineAction(id: string, input: unknown): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = routineInputSchema.partial().safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  if (!(await updateRoutine(userId, id, p.data))) return { ok: false, error: "לא נמצא" };
  refresh();
  return { ok: true };
}

export async function deleteRoutineAction(id: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!(await deleteRoutine(userId, id))) return { ok: false, error: "לא נמצא" };
  refresh();
  return { ok: true };
}

export async function logRoutineDayAction(id: string, date: string, status: "done" | "skipped" | null): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "תאריך לא תקין" };
  if (!(await logRoutine(userId, id, date, status))) return { ok: false, error: "לא נמצא" };
  refresh();
  return { ok: true };
}
