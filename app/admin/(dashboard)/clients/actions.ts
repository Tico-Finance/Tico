"use server";

import { currentUserId } from "@/lib/auth";
import { clientInputSchema, clientPatchSchema } from "@/lib/clients";
import {
  addClientNote,
  advanceClient,
  createClient,
  markMilestone,
  markUpdateSent,
  undoClientAction,
  updateClient,
} from "@/lib/clients-db";
import { toClientEventRow, toClientRow, type ClientEventRow, type ClientRow } from "./types";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };
const NOT_LOGGED_IN = { ok: false, error: "לא מחובר" } as const;
const NOT_FOUND = { ok: false, error: "לא נמצא" } as const;

export async function createClientAction(input: unknown): Promise<Result<{ client: ClientRow; event: ClientEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const p = clientInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const r = await createClient(userId, { ...p.data, process: p.data.process });
  if (!r) return NOT_FOUND;
  return { ok: true, client: toClientRow(r.client), event: toClientEventRow(r.event) };
}

export async function advanceClientAction(id: string): Promise<Result<{ client: ClientRow; event: ClientEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await advanceClient(userId, id);
  if (!r) return NOT_FOUND;
  return { ok: true, client: toClientRow(r.client), event: toClientEventRow(r.event) };
}

export async function milestoneAction(id: string, key: string): Promise<Result<{ client: ClientRow; event: ClientEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await markMilestone(userId, id, key);
  if (!r) return NOT_FOUND;
  return { ok: true, client: toClientRow(r.client), event: toClientEventRow(r.event) };
}

export async function updateSentAction(id: string, messageKey?: string): Promise<Result<{ client: ClientRow; event: ClientEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await markUpdateSent(userId, id, messageKey);
  if (!r) return NOT_FOUND;
  return { ok: true, client: toClientRow(r.client), event: toClientEventRow(r.event) };
}

export async function updateClientAction(id: string, patch: unknown): Promise<Result<{ client: ClientRow; events: ClientEventRow[] }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const p = clientPatchSchema.safeParse(patch);
  if (!p.success) return { ok: false, error: "הנתונים אינם תקינים" };
  const r = await updateClient(userId, id, p.data);
  if (!r) return NOT_FOUND;
  return { ok: true, client: toClientRow(r.client), events: r.events.map(toClientEventRow) };
}

export async function addClientNoteAction(id: string, text: string): Promise<Result<{ event: ClientEventRow }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  if (!text.trim()) return { ok: false, error: "הערה ריקה" };
  const ev = await addClientNote(userId, id, text);
  if (!ev) return NOT_FOUND;
  return { ok: true, event: toClientEventRow(ev) };
}

/** Undo the latest stage action (stage done, milestone, update sent) on a client. */
export async function undoClientActionAction(id: string): Promise<Result<{ client: ClientRow; removedEventId: string }>> {
  const userId = await currentUserId();
  if (!userId) return NOT_LOGGED_IN;
  const r = await undoClientAction(userId, id);
  if (!r) return { ok: false, error: "אין פעולה לבטל" };
  return { ok: true, client: toClientRow(r.client), removedEventId: r.removedEventId };
}
