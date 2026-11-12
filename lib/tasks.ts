import { z } from "zod";

// Manual tasks: things that are not already tracked as a partner, client, lead or content item.

export const TASK_GOALS = ["revenue", "growth", "exposure", "admin"] as const;
const short = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const taskInputSchema = z.object({
  title: short(200).min(1),
  dueAt: isoDate.optional().nullable(),
  important: z.boolean().default(false),
  estMinutes: z.number().int().min(5).max(480).default(15),
  goal: z.enum(TASK_GOALS).default("admin"),
});

export const taskPatchSchema = z.object({
  title: short(200).min(1).optional(),
  dueAt: isoDate.optional().nullable(),
  important: z.boolean().optional(),
  estMinutes: z.number().int().min(5).max(480).optional(),
  goal: z.enum(TASK_GOALS).optional(),
  quadrantOverride: z.number().int().min(1).max(4).optional().nullable(),
  status: z.enum(["open", "done", "dropped"]).optional(),
  notes: short(2000).optional(),
});
