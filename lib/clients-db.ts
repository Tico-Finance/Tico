import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientEvents, clients, leads } from "@/drizzle/schema";
import {
  PROCESSES,
  advanceStage,
  messageByKey,
  milestoneByKey,
  processOf,
  stageOf,
  startStage,
  type ProcessKey,
} from "@/lib/clients";
import { todayIL } from "@/lib/partners";

// Database operations for client journeys. They take the user id explicitly, so server actions
// stay thin (auth + validation) and these can be exercised against a test database.

export type ClientRecord = typeof clients.$inferSelect;
export type ClientEventRecord = typeof clientEvents.$inferSelect;

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

async function logEvent(userId: string, clientId: string, kind: string, text: string, stageKey?: string | null) {
  const [ev] = await db
    .insert(clientEvents)
    .values({ clientId, userId, kind, text, stageKey: stageKey ?? null })
    .returning();
  return ev;
}

async function owned(userId: string, id: string): Promise<ClientRecord | null> {
  const [c] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).limit(1);
  return c ?? null;
}

export async function createClient(
  userId: string,
  input: { name: string; phone?: string | null; process: ProcessKey; leadId?: string | null; notes?: string },
  today: string = todayIL()
): Promise<{ client: ClientRecord; event: ClientEventRecord } | null> {
  let leadId: string | null = null;
  if (input.leadId) {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, input.leadId), eq(leads.userId, userId))).limit(1);
    if (!lead) return null;
    leadId = lead.id;
  }
  const start = startStage(input.process, 0, today);
  const first = stageOf(input.process, 0);
  const [client] = await db
    .insert(clients)
    .values({
      userId,
      name: input.name,
      phone: clean(input.phone),
      process: input.process,
      stageIndex: 0,
      stageStartedAt: start?.stageStartedAt ?? today,
      stageDueAt: start?.stageDueAt ?? null,
      pendingMessage: first ? `enter:${first.key}` : null,
      leadId,
      notes: input.notes ?? "",
    })
    .returning();
  if (leadId) await db.update(leads).set({ stage: "client", updatedAt: new Date() }).where(eq(leads.id, leadId));
  const event = await logEvent(userId, client.id, "created", `נפתח תיק: ${processOf(input.process).label}`, first?.key);
  return { client, event };
}

/** The current stage is done: move to the next one (or complete) and queue the matching update message. */
export async function advanceClient(userId: string, id: string, today: string = todayIL()) {
  const c = await owned(userId, id);
  if (!c || c.status !== "active") return null;
  const r = advanceStage(c.process, c.stageIndex, today);
  const [client] = await db
    .update(clients)
    .set(
      r.completed
        ? { status: "completed", pendingMessage: r.pendingMessage, updatedAt: new Date() }
        : {
            stageIndex: r.next!.stageIndex,
            stageStartedAt: r.next!.stageStartedAt,
            stageDueAt: r.next!.stageDueAt,
            pendingMessage: r.pendingMessage,
            updatedAt: new Date(),
          }
    )
    .where(eq(clients.id, id))
    .returning();
  const event = await logEvent(userId, id, "stage_done", r.eventText, stageOf(c.process, c.stageIndex)?.key);
  return { client, event };
}

/** A milestone inside the current stage happened: queue its short update message. */
export async function markMilestone(userId: string, id: string, key: string) {
  const c = await owned(userId, id);
  const m = milestoneByKey(key);
  if (!c || !m) return null;
  const [client] = await db
    .update(clients)
    .set({ pendingMessage: m.message.key, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  const event = await logEvent(userId, id, "milestone", `אבן דרך: ${m.label}`, stageOf(c.process, c.stageIndex)?.key);
  return { client, event };
}

/** The pending update message was sent to the client. */
export async function markUpdateSent(userId: string, id: string, messageKey?: string | null) {
  const c = await owned(userId, id);
  if (!c) return null;
  const key = messageKey ?? c.pendingMessage;
  const title = (key && messageByKey(key)?.title) || "עדכון";
  const [client] = await db
    .update(clients)
    .set({ pendingMessage: null, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  const event = await logEvent(userId, id, "update_sent", `נשלח עדכון: ${title}`, stageOf(c.process, c.stageIndex)?.key);
  return { client, event };
}

export interface ClientPatch {
  name?: string;
  phone?: string | null;
  process?: ProcessKey;
  stageIndex?: number;
  stageDueAt?: string | null;
  status?: "active" | "completed" | "archived";
  notes?: string;
}

export async function updateClient(userId: string, id: string, patch: ClientPatch, today: string = todayIL()) {
  const c = await owned(userId, id);
  if (!c) return null;
  const set: Partial<typeof clients.$inferInsert> = { updatedAt: new Date() };
  const events: { kind: string; text: string }[] = [];

  if (patch.name !== undefined) set.name = patch.name;
  if (patch.phone !== undefined) set.phone = clean(patch.phone);
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.status !== undefined && patch.status !== c.status) {
    set.status = patch.status;
    events.push({ kind: "status", text: patch.status === "active" ? "התיק נפתח מחדש" : patch.status === "completed" ? "התיק סומן כהושלם" : "התיק הועבר לארכיון" });
  }

  const process = patch.process ?? (c.process as ProcessKey);
  if (patch.process !== undefined && patch.process !== c.process) {
    set.process = patch.process;
    const last = PROCESSES[patch.process].stages.length - 1;
    const idx = Math.min(patch.stageIndex ?? c.stageIndex, last);
    const s = startStage(patch.process, idx, today);
    set.stageIndex = idx;
    set.stageStartedAt = c.stageStartedAt ?? s?.stageStartedAt ?? today;
    set.stageDueAt = s?.stageDueAt ?? null;
    set.pendingMessage = null;
    events.push({ kind: "process_changed", text: `סוג התהליך שונה ל${PROCESSES[patch.process].label}` });
  } else if (patch.stageIndex !== undefined && patch.stageIndex !== c.stageIndex) {
    const st = stageOf(process, patch.stageIndex);
    if (!st) return null;
    const s = startStage(process, patch.stageIndex, today)!;
    set.stageIndex = s.stageIndex;
    set.stageStartedAt = s.stageStartedAt;
    set.stageDueAt = s.stageDueAt;
    set.pendingMessage = null;
    events.push({ kind: "stage_set", text: `השלב עודכן ידנית ל${st.label}` });
  }
  if (patch.stageDueAt !== undefined) set.stageDueAt = patch.stageDueAt;

  const [client] = await db.update(clients).set(set).where(eq(clients.id, id)).returning();
  const out: ClientEventRecord[] = [];
  for (const e of events) out.push(await logEvent(userId, id, e.kind, e.text, stageOf(client.process, client.stageIndex)?.key));
  return { client, events: out };
}

export async function addClientNote(userId: string, id: string, text: string) {
  const c = await owned(userId, id);
  if (!c) return null;
  return logEvent(userId, id, "note", text.trim().slice(0, 2000), stageOf(c.process, c.stageIndex)?.key);
}
