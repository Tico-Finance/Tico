"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscribers } from "@/drizzle/schema";
import {
  UNSUBSCRIBE_OTHER_KEY,
  UNSUBSCRIBE_REASON_KEYS,
} from "@/lib/unsubscribe-reasons";

export async function confirmUnsubscribeAction(
  token: string,
  reasons: string[] = [],
  note = ""
) {
  const subscriber = await db.query.subscribers.findFirst({
    where: eq(subscribers.unsubscribeToken, token),
  });
  if (!subscriber) return { ok: false as const };

  const allowed = [...UNSUBSCRIBE_REASON_KEYS, UNSUBSCRIBE_OTHER_KEY];
  const cleanReasons = Array.from(new Set(reasons.filter((r) => allowed.includes(r))));
  const cleanNote = cleanReasons.includes(UNSUBSCRIBE_OTHER_KEY)
    ? note.trim().slice(0, 500) || null
    : null;

  await db
    .update(subscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeReasons: cleanReasons.length > 0 ? cleanReasons : null,
      unsubscribeNote: cleanNote,
    })
    .where(eq(subscribers.id, subscriber.id));

  return { ok: true as const, email: subscriber.email };
}
