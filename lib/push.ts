import * as webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushKeys, pushSubscriptions } from "@/drizzle/schema";
import type { PushPayload } from "@/lib/push-text";

// Web Push: keys, subscriptions and sending. The key pair is generated on first use and kept in
// the database, so nothing secret has to live in the environment.

const SUBJECT = "https://app.ticofinance.co.il";

export async function getVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const read = async () => (await db.select().from(pushKeys).where(eq(pushKeys.id, "vapid")).limit(1))[0];
  const existing = await read();
  if (existing) return existing;
  const k = webpush.generateVAPIDKeys();
  await db.insert(pushKeys).values({ id: "vapid", publicKey: k.publicKey, privateKey: k.privateKey }).onConflictDoNothing();
  // Two requests can race: whichever row won is the one everyone uses.
  return (await read()) as { publicKey: string; privateKey: string };
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(userId: string, sub: BrowserSubscription, userAgent: string | null) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent } });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}

export async function listSubscriptions(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

type Sender = (sub: BrowserSubscription, payload: string, options: { TTL: number }) => Promise<unknown>;
export type PushKind = "morning" | "nudge" | "test";
export interface PushResult {
  sent: number;
  removed: number;
  skipped: number;
  failed: number;
}

const RESEND_GUARD_MS = 18 * 3_600_000;

/** Send one notification to every device of the user. A morning or nudge notification is never sent twice in a day. */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  kind: PushKind,
  opts: { sender?: Sender; now?: Date } = {}
): Promise<PushResult> {
  const now = opts.now ?? new Date();
  const subs = await listSubscriptions(userId);
  const result: PushResult = { sent: 0, removed: 0, skipped: 0, failed: 0 };
  if (!subs.length) return result;

  let sender = opts.sender;
  if (!sender) {
    const vapid = await getVapid();
    webpush.setVapidDetails(SUBJECT, vapid.publicKey, vapid.privateKey);
    sender = (sub, body, options) => webpush.sendNotification(sub, body, options);
  }

  for (const s of subs) {
    const last = kind === "morning" ? s.lastMorningAt : kind === "nudge" ? s.lastNudgeAt : null;
    if (last && now.getTime() - last.getTime() < RESEND_GUARD_MS) {
      result.skipped++;
      continue;
    }
    try {
      await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      result.sent++;
      if (kind !== "test") {
        await db
          .update(pushSubscriptions)
          .set(kind === "morning" ? { lastMorningAt: now } : { lastNudgeAt: now })
          .where(eq(pushSubscriptions.id, s.id));
      }
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        result.removed++;
      } else {
        result.failed++;
      }
    }
  }
  return result;
}
