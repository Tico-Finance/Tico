import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerEvents, partners } from "@/drizzle/schema";
import { partnerExternalKey, planAction, todayIL, type PartnerAction, type PartnerImportItem } from "@/lib/partners";

// Database operations for the partners module. They take the user id explicitly, so server
// actions stay thin (auth + validation) and these can be exercised against a test database.

export type PartnerRecord = typeof partners.$inferSelect;
export type PartnerEventRecord = typeof partnerEvents.$inferSelect;

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Apply one cadence action: moves the stage, schedules the next step and records the event. */
export async function applyPartnerAction(
  userId: string,
  id: string,
  action: PartnerAction,
  today: string = todayIL()
): Promise<{ partner: PartnerRecord; event: PartnerEventRecord } | null> {
  const [current] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.userId, userId)))
    .limit(1);
  if (!current) return null;

  const o = planAction(action, today);
  const [partner] = await db
    .update(partners)
    .set({
      stage: o.stage,
      nextAt: o.nextAt,
      nextAction: o.nextAction,
      ...(o.followDate ? { followDate: o.followDate } : {}),
      ...(o.coupon ? { coupon: true } : {}),
      updatedAt: new Date(),
    })
    .where(eq(partners.id, id))
    .returning();
  const [event] = await db
    .insert(partnerEvents)
    .values({
      partnerId: id,
      userId,
      kind: o.eventKind,
      text: o.eventText,
      hook: current.hook,
      prev: {
        stage: current.stage,
        nextAt: current.nextAt,
        nextAction: current.nextAction,
        followDate: current.followDate,
        coupon: current.coupon,
      },
    })
    .returning();
  return { partner, event };
}

/** Undo the latest cadence action: restores the state it replaced and removes its history row. */
export async function undoPartnerAction(
  userId: string,
  id: string
): Promise<{ partner: PartnerRecord; removedEventId: string } | null> {
  const [last] = await db
    .select()
    .from(partnerEvents)
    .where(and(eq(partnerEvents.partnerId, id), eq(partnerEvents.userId, userId), isNotNull(partnerEvents.prev)))
    .orderBy(desc(partnerEvents.at))
    .limit(1);
  if (!last?.prev) return null;
  const prev = last.prev as {
    stage: string;
    nextAt: string | null;
    nextAction: string | null;
    followDate: string | null;
    coupon: boolean;
  };
  const [partner] = await db
    .update(partners)
    .set({
      stage: prev.stage,
      nextAt: prev.nextAt,
      nextAction: prev.nextAction,
      followDate: prev.followDate,
      coupon: prev.coupon,
      updatedAt: new Date(),
    })
    .where(and(eq(partners.id, id), eq(partners.userId, userId)))
    .returning();
  if (!partner) return null;
  await db.delete(partnerEvents).where(eq(partnerEvents.id, last.id));
  return { partner, removedEventId: last.id };
}

/** Import partners. Safe to run again: a partner whose key already exists is skipped. */
export async function importPartners(userId: string, items: PartnerImportItem[]) {
  const created: PartnerRecord[] = [];
  const events: PartnerEventRecord[] = [];
  let skipped = 0;
  for (const it of items) {
    const [row] = await db
      .insert(partners)
      .values({
        userId,
        kind: it.kind,
        name: it.name,
        org: clean(it.org),
        instagram: clean(it.instagram),
        facebook: clean(it.facebook),
        tiktok: clean(it.tiktok),
        phone: clean(it.phone),
        area: clean(it.area),
        address: clean(it.address),
        route: clean(it.route),
        why: clean(it.why),
        channel: clean(it.channel),
        details: it.details ?? {},
        priority: clean(it.priority),
        wave: it.wave ?? null,
        hook: clean(it.hook),
        stage: it.stage ?? "cold",
        nextAction: clean(it.nextAction),
        nextAt: it.nextAt ?? null,
        followDate: it.followDate ?? null,
        notes: it.notes ?? "",
        archived: it.archived ?? false,
        archiveReason: clean(it.archiveReason),
        externalKey: clean(it.externalKey) ?? partnerExternalKey(it),
      })
      .onConflictDoNothing({ target: [partners.userId, partners.externalKey] })
      .returning();
    if (!row) {
      skipped++;
      continue;
    }
    created.push(row);
    const evs = it.events?.length ? it.events : [{ kind: "created", text: "יובא למערכת", at: undefined }];
    for (const e of evs) {
      const at = e.at ? new Date(e.at) : new Date();
      const [ev] = await db
        .insert(partnerEvents)
        .values({
          partnerId: row.id,
          userId,
          kind: e.kind,
          text: e.text,
          hook: row.hook,
          at: Number.isNaN(at.getTime()) ? new Date() : at,
        })
        .returning();
      events.push(ev);
    }
  }
  return { created, events, skipped };
}
