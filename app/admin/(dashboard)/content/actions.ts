"use server";

import { currentUserId } from "@/lib/auth";
import { uploadContentScreenshot } from "@/lib/blob";
import { contentInputSchema, contentPatchSchema } from "@/lib/content";
import { readPerformanceScreenshot } from "@/lib/content-ai";
import {
  attachScreenshot,
  createContent,
  deleteContent,
  getContent,
  importPublishedDrafts,
  updateContent,
} from "@/lib/content-db";
import { toContentRow, type ContentRow } from "./types";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };
const NOT_LOGGED_IN = { ok: false, error: "לא מחובר" } as const;
const NOT_FOUND = { ok: false, error: "לא נמצא" } as const;

export async function createContentAction(input: unknown): Promise<Result<{ content: ContentRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const p = contentInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  return { ok: true, content: toContentRow(await createContent(userId, p.data)) };
}

export async function updateContentAction(id: string, patch: unknown): Promise<Result<{ content: ContentRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const p = contentPatchSchema.safeParse(patch);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const row = await updateContent(userId, id, p.data);
  return row ? { ok: true, content: toContentRow(row) } : NOT_FOUND;
}

export async function deleteContentAction(id: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  return (await deleteContent(userId, id)) ? { ok: true } : NOT_FOUND;
}

export async function importDraftsAction(): Promise<Result<{ items: ContentRow[] }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const rows = await importPublishedDrafts(userId);
  return { ok: true, items: rows.map(toContentRow) };
}

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

/** Upload a performance screenshot, read the numbers from it, and save both. */
export async function readScreenshotAction(id: string, formData: FormData): Promise<Result<{ content: ContentRow; found: number }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "לא נבחר קובץ" };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "אפשר להעלות רק תמונה (PNG, JPG או WebP)" };
  if (file.size > MAX_BYTES) return { ok: false, error: "התמונה גדולה מדי (עד 4MB). צלם מסך חדש או כווץ אותה" };
  const item = await getContent(userId, id);
  if (!item) return NOT_FOUND;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const reading = await readPerformanceScreenshot(buf, file.type, {
      platform: item.platform,
      format: item.format,
      topic: item.topic,
      caption: item.caption,
    });
    const url = await uploadContentScreenshot(buf, file.type);
    const row = await attachScreenshot(userId, id, { url, metrics: reading.metrics, insights: reading.insights });
    if (!row) return NOT_FOUND;
    return { ok: true, content: toContentRow(row), found: Object.keys(reading.metrics).length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "הקריאה של הצילום נכשלה" };
  }
}
