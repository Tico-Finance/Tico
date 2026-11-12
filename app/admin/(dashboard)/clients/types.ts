import type { clientEvents, clients } from "@/drizzle/schema";
import type { ClientStatus, ProcessKey } from "@/lib/clients";

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  process: ProcessKey;
  stageIndex: number;
  stageStartedAt: string | null;
  stageDueAt: string | null;
  status: ClientStatus;
  pendingMessage: string | null;
  leadId: string | null;
  notes: string;
}

export interface ClientEventRow {
  id: string;
  clientId: string;
  kind: string;
  text: string;
  stageKey: string | null;
  at: string;
}

export interface LeadOption {
  id: string;
  name: string;
  phone: string | null;
}

export function toClientRow(r: typeof clients.$inferSelect): ClientRow {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    process: r.process as ProcessKey,
    stageIndex: r.stageIndex,
    stageStartedAt: r.stageStartedAt,
    stageDueAt: r.stageDueAt,
    status: r.status as ClientStatus,
    pendingMessage: r.pendingMessage,
    leadId: r.leadId,
    notes: r.notes,
  };
}

export function toClientEventRow(e: typeof clientEvents.$inferSelect): ClientEventRow {
  return { id: e.id, clientId: e.clientId, kind: e.kind, text: e.text, stageKey: e.stageKey, at: e.at.toISOString() };
}
