"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerEvents, partners } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import { applyPartnerAction, importPartners, undoPartnerAction } from "@/lib/partners-db";
import {
  PARTNER_ACTIONS,
  partnerImportSchema,
  partnerInputSchema,
  partnerPatchSchema,
  type PartnerAction,
} from "@/lib/partners";
import { toEventRow, toPartnerRow, type PartnerEventRow, type PartnerRow } from "./types";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function createPartnerAction(input: unknown): Promise<Result<{ partner: PartnerRow; event: PartnerEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = partnerInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const v = p.data;
  const [row] = await db
    .insert(partners)
    .values({
      userId,
      kind: v.kind,
      name: v.name,
      org: clean(v.org),
      instagram: clean(v.instagram),
      facebook: clean(v.facebook),
      tiktok: clean(v.tiktok),
      phone: clean(v.phone),
      area: clean(v.area),
      address: clean(v.address),
      route: clean(v.route),
      why: clean(v.why),
      channel: clean(v.channel),
      priority: clean(v.priority),
      wave: v.wave ?? null,
      hook: clean(v.hook),
      notes: v.notes ?? "",
      externalKey: clean(v.externalKey),
      stage: "cold",
      nextAction: v.kind === "broker" ? "להתחיל חימום באינסטגרם" : "לתכנן ביקור",
    })
    .returning();
  const [ev] = await db
    .insert(partnerEvents)
    .values({ partnerId: row.id, userId, kind: "created", text: "נוסף למערכת" })
    .returning();
  return { ok: true, partner: toPartnerRow(row), event: toEventRow(ev) };
}

export async function updatePartnerAction(id: string, patch: unknown): Promise<Result<{ partner: PartnerRow }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const p = partnerPatchSchema.safeParse(patch);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const v = p.data;
  const set: Partial<typeof partners.$inferInsert> = { updatedAt: new Date() };
  if (v.kind !== undefined) set.kind = v.kind;
  if (v.name !== undefined) set.name = v.name;
  if (v.org !== undefined) set.org = clean(v.org);
  if (v.instagram !== undefined) set.instagram = clean(v.instagram);
  if (v.facebook !== undefined) set.facebook = clean(v.facebook);
  if (v.tiktok !== undefined) set.tiktok = clean(v.tiktok);
  if (v.phone !== undefined) set.phone = clean(v.phone);
  if (v.area !== undefined) set.area = clean(v.area);
  if (v.address !== undefined) set.address = clean(v.address);
  if (v.route !== undefined) set.route = clean(v.route);
  if (v.why !== undefined) set.why = clean(v.why);
  if (v.channel !== undefined) set.channel = clean(v.channel);
  if (v.priority !== undefined) set.priority = clean(v.priority);
  if (v.wave !== undefined) set.wave = v.wave ?? null;
  if (v.hook !== undefined) set.hook = clean(v.hook);
  if (v.notes !== undefined) set.notes = v.notes;
  if (v.stage !== undefined) set.stage = v.stage;
  if (v.nextAction !== undefined) set.nextAction = clean(v.nextAction);
  if (v.nextAt !== undefined) set.nextAt = v.nextAt ?? null;
  if (v.followDate !== undefined) set.followDate = v.followDate ?? null;
  if (v.archived !== undefined) set.archived = v.archived;
  if (v.archiveReason !== undefined) set.archiveReason = clean(v.archiveReason);

  const [row] = await db
    .update(partners)
    .set(set)
    .where(and(eq(partners.id, id), eq(partners.userId, userId)))
    .returning();
  if (!row) return { ok: false, error: "לא נמצא" };
  return { ok: true, partner: toPartnerRow(row) };
}

/** Apply one cadence action: moves the stage, schedules the next step and records the event. */
export async function performPartnerAction(
  id: string,
  action: string
): Promise<Result<{ partner: PartnerRow; event: PartnerEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  if (!(PARTNER_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: "פעולה לא מוכרת" };
  const res = await applyPartnerAction(userId, id, action as PartnerAction);
  if (!res) return { ok: false, error: "לא נמצא" };
  return { ok: true, partner: toPartnerRow(res.partner), event: toEventRow(res.event) };
}

export async function addPartnerNoteAction(id: string, text: string): Promise<Result<{ event: PartnerEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const t = text.trim().slice(0, 2000);
  if (!t) return { ok: false, error: "הערה ריקה" };
  const [owned] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.userId, userId)))
    .limit(1);
  if (!owned) return { ok: false, error: "לא נמצא" };
  const [ev] = await db
    .insert(partnerEvents)
    .values({ partnerId: id, userId, kind: "note", text: t })
    .returning();
  return { ok: true, event: toEventRow(ev) };
}

/** Import partners from a JSON file. Safe to run again: a partner already imported is skipped. */
export async function importPartnersAction(
  input: unknown
): Promise<Result<{ created: number; skipped: number; partners: PartnerRow[]; events: PartnerEventRow[] }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const parsed = partnerImportSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `הקובץ אינו תקין (${first?.path.join(".") ?? ""}: ${first?.message ?? ""})` };
  }
  const r = await importPartners(userId, parsed.data);
  return { ok: true, created: r.created.length, skipped: r.skipped, partners: r.created.map(toPartnerRow), events: r.events.map(toEventRow) };
}

/** Undo the latest action (stage change, message sent...) on a partner. */
export async function undoPartnerActionAction(id: string): Promise<Result<{ partner: PartnerRow; removedEventId: string }>> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "לא מחובר" };
  const r = await undoPartnerAction(userId, id);
  if (!r) return { ok: false, error: "אין פעולה לבטל" };
  return { ok: true, partner: toPartnerRow(r.partner), removedEventId: r.removedEventId };
}
