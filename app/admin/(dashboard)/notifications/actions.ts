"use server";

import { z } from "zod";
import { currentUserId } from "@/lib/auth";
import { buildDay } from "@/lib/day";
import { removeSubscription, saveSubscription, sendToUser } from "@/lib/push";
import { morningDigest } from "@/lib/push-text";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };
const NOT_LOGGED_IN = { ok: false, error: "לא מחובר" } as const;

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }),
});

export async function savePushSubscriptionAction(sub: unknown, userAgent: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const p = subSchema.safeParse(sub);
  if (!p.success) return { ok: false, error: "המכשיר לא החזיר פרטי התראות תקינים" };
  await saveSubscription(userId, p.data, userAgent.slice(0, 300));
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  await removeSubscription(userId, endpoint);
  return { ok: true };
}

/** A short test message to every device. */
export async function sendTestPushAction(): Promise<Result<{ sent: number; removed: number; failed: number }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await sendToUser(userId, { title: "ההתראות עובדות", body: "ככה תיראה התראה מ-Tico על הטלפון.", url: "/admin/home", tag: "test" }, "test");
  return { ok: true, sent: r.sent, removed: r.removed, failed: r.failed };
}

/** Today's morning notification, sent now, so the real text can be checked. */
export async function sendMorningPreviewAction(): Promise<Result<{ sent: number; removed: number; failed: number }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await sendToUser(userId, morningDigest(await buildDay(userId)), "test");
  return { ok: true, sent: r.sent, removed: r.removed, failed: r.failed };
}
