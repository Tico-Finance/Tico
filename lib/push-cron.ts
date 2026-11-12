import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/drizzle/schema";
import { buildDay } from "@/lib/day";
import { sendToUser } from "@/lib/push";
import { moneyNudge, morningDigest, type PushPayload } from "@/lib/push-text";

/**
 * Cron requests are checked with CRON_SECRET when it is set. Without it (the existing cron jobs
 * share this variable and it is not configured), only Vercel's cron user agent is accepted, and
 * the once-a-day guard in sendToUser keeps a forged request from sending more than one message.
 */
export function cronAllowed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
}

export async function runPushCron(req: NextRequest, kind: "morning" | "nudge") {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
  const out: { userId: string; sent: number; note?: string }[] = [];
  for (const { userId } of users) {
    try {
      const day = await buildDay(userId);
      const payload: PushPayload | null = kind === "morning" ? morningDigest(day) : moneyNudge(day);
      if (!payload) {
        out.push({ userId, sent: 0, note: "nothing to send" });
        continue;
      }
      const r = await sendToUser(userId, payload, kind);
      out.push({ userId, sent: r.sent });
    } catch (e) {
      out.push({ userId, sent: 0, note: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ok: true, kind, users: out.length, results: out });
}
