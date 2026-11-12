"use client";

import Link from "next/link";
import type { Agenda, AgendaGroup } from "@/lib/agenda";

const GROUP_LABEL: Record<AgendaGroup, string> = { partners: "שותפים", clients: "לקוחות", content: "תוכן" };
const SHOWN = 8;

/** What is waiting across partners, clients and content. */
export default function AgendaSection({ agenda }: { agenda: Agenda }) {
  const total = agenda.items.length;
  const pct = Math.min(100, Math.round((agenda.sentToday / agenda.cap) * 100));
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-primary">
          משימות מכל המערכת
          <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">{total}</span>
        </h2>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/partners" className="text-secondary">שותפים</Link>
          <Link href="/admin/clients" className="text-secondary">לקוחות</Link>
          <Link href="/admin/content" className="text-secondary">תוכן</Link>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 text-xs text-foreground/60">
        <span>הודעות לשותפים היום: <b className="text-foreground">{agenda.sentToday} / {agenda.cap}</b></span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-button" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {total === 0 ? (
        <p className="py-3 text-sm text-foreground/50">אין משימות פתוחות בשותפים, בלקוחות ובתוכן.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {agenda.items.slice(0, SHOWN).map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium">{i.title}</div>
                  <div className={`truncate text-sm ${i.tone === "late" ? "text-rose-600" : "text-foreground/70"}`}>{i.sub}</div>
                </div>
                <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-foreground/70">{GROUP_LABEL[i.group]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > SHOWN && <p className="mt-2 text-center text-sm text-foreground/60">{`ועוד ${total - SHOWN}. אפשר לראות את כולם בלשוניות.`}</p>}
    </section>
  );
}
