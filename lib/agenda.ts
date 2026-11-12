import { daysLate, messageByKey, processOf, stageOf } from "./clients";
import { DAILY_CAP, STAGE_LABELS, diffDays } from "./partners";

// One list of what is waiting for you across partners, clients and content,
// shown at the top of the home screen.

export type AgendaGroup = "partners" | "clients" | "content";

export interface AgendaItem {
  key: string;
  group: AgendaGroup;
  title: string;
  sub: string;
  href: string;
  tone: "late" | "today";
  /** Sort key within a tone (a date). */
  due: string;
}

export interface Agenda {
  items: AgendaItem[];
  counts: Record<AgendaGroup, number>;
  sentToday: number;
  cap: number;
}

export interface AgendaInput {
  partners: { id: string; name: string; stage: string; nextAt: string | null; nextAction: string | null; archived: boolean }[];
  clients: { id: string; name: string; process: string; stageIndex: number; stageDueAt: string | null; status: string; pendingMessage: string | null }[];
  content: { id: string; title: string; status: string; plannedAt: string | null }[];
  sentToday: number;
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function buildAgenda(input: AgendaInput, today: string): Agenda {
  const items: AgendaItem[] = [];

  for (const p of input.partners) {
    if (p.archived || p.stage === "dead" || !p.nextAt || p.nextAt > today) continue;
    const late = p.nextAt < today;
    items.push({
      key: `p:${p.id}`,
      group: "partners",
      title: p.name,
      sub: `${p.nextAction || STAGE_LABELS[p.stage as keyof typeof STAGE_LABELS] || ""}${late ? ` · באיחור ${diffDays(today, p.nextAt)} י׳` : ""}`,
      href: "/admin/partners",
      tone: late ? "late" : "today",
      due: p.nextAt,
    });
  }

  for (const c of input.clients) {
    if (c.status !== "active") continue;
    if (c.pendingMessage) {
      items.push({
        key: `c:${c.id}`,
        group: "clients",
        title: `עדכון ללקוח: ${c.name}`,
        sub: messageByKey(c.pendingMessage)?.title ?? "הודעה מוכנה לשליחה",
        href: "/admin/clients",
        tone: "today",
        due: today,
      });
      continue;
    }
    const late = daysLate(c.stageDueAt, today);
    if (late > 0) {
      items.push({
        key: `c:${c.id}`,
        group: "clients",
        title: `${c.name} בעיכוב ${late} י׳`,
        sub: `${processOf(c.process).label} · ${stageOf(c.process, c.stageIndex)?.label ?? ""}`,
        href: "/admin/clients",
        tone: "late",
        due: c.stageDueAt ?? today,
      });
    }
  }

  for (const k of input.content) {
    if (k.status !== "planned" || !k.plannedAt || k.plannedAt > today) continue;
    const late = k.plannedAt < today;
    items.push({
      key: `k:${k.id}`,
      group: "content",
      title: k.title,
      sub: late ? `היה מתוכנן ל-${fmt(k.plannedAt)}` : "מתוכנן להיום",
      href: "/admin/content",
      tone: late ? "late" : "today",
      due: k.plannedAt,
    });
  }

  const rank = { late: 0, today: 1 } as const;
  items.sort((a, b) => rank[a.tone] - rank[b.tone] || a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "he"));
  const counts: Record<AgendaGroup, number> = { partners: 0, clients: 0, content: 0 };
  for (const i of items) counts[i.group]++;
  return { items, counts, sentToday: input.sentToday, cap: DAILY_CAP };
}
