"use client";

import { useEffect, useState } from "react";
import {
  ALL_MESSAGES,
  CLIENT_STATUS_LABELS,
  PROCESSES,
  PROCESS_KEYS,
  currentMessageKey,
  daysLate,
  messageByKey,
  milestonesFor,
  processOf,
  stageOf,
  type ProcessKey,
} from "@/lib/clients";
import { fillTemplate, hasPlaceholders, partnerWhatsappLink, todayIL } from "@/lib/partners";
import {
  addClientNoteAction,
  advanceClientAction,
  createClientAction,
  milestoneAction,
  undoClientActionAction,
  updateClientAction,
  updateSentAction,
} from "./actions";
import type { ClientEventRow, ClientRow, LeadOption } from "./types";

type View = "updates" | "active" | "done" | "archive";

const VIEWS: { id: View; label: string }[] = [
  { id: "updates", label: "עדכוני שלב" },
  { id: "active", label: "לקוחות פעילים" },
  { id: "done", label: "הושלמו" },
  { id: "archive", label: "ארכיון" },
];

const field = "w-full rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-sm";
const btn = "rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const ghost = "rounded-lg border border-black/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/5";
const box = "rounded-xl border border-black/5 bg-surface p-3 shadow-sm";

const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

function Chip({ children, tone = "bg-slate-100 text-slate-700" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Dots showing how far along the journey is. */
function Progress({ c }: { c: ClientRow }) {
  const stages = processOf(c.process).stages;
  return (
    <div className="flex items-center gap-1" aria-label={`שלב ${c.stageIndex + 1} מתוך ${stages.length}`}>
      {stages.map((s, i) => {
        const done = c.status === "completed" || i < c.stageIndex;
        const current = c.status === "active" && i === c.stageIndex;
        return (
          <span
            key={s.key + i}
            title={s.label}
            className={`h-2.5 rounded-full ${current ? "w-6 bg-button" : done ? "w-2.5 bg-button/60" : "w-2.5 bg-black/15"}`}
          />
        );
      })}
    </div>
  );
}

/** Editable update message with copy, WhatsApp link and "sent". Re-mounted (via key) when the message changes. */
function MessageBox({
  client, messageKey, onSent, say, busy,
}: {
  client: ClientRow;
  messageKey: string;
  onSent?: () => void;
  say: (m: string) => void;
  busy: boolean;
}) {
  const msg = messageByKey(messageKey);
  const [text, setText] = useState(() => fillTemplate(msg?.body ?? "", client.name));
  const wa = partnerWhatsappLink(client.phone, text);
  if (!msg) return null;
  return (
    <div>
      <div className="text-xs text-foreground/60">{msg.title}</div>
      {msg.prep && <div className="my-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">להשלים: {msg.prep}</div>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={`${field} mt-1 leading-relaxed`} />
      {hasPlaceholders(text) && <div className="mt-1 text-xs text-rose-700">יש בהודעה סוגריים מרובעים. השלם אותם לפני שליחה.</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={ghost} onClick={async () => say((await copyText(text)) ? "הועתק" : "ההעתקה נחסמה. סמן והעתק ידנית")}>העתק</button>
        {wa && <a className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-slate-900" href={wa} target="_blank" rel="noopener noreferrer">וואטסאפ עם ההודעה</a>}
        {onSent && <button className={btn} disabled={busy} onClick={onSent}>שלחתי</button>}
      </div>
    </div>
  );
}

export default function ClientsApp({
  initialRows,
  initialEvents,
  leadOptions,
}: {
  initialRows: ClientRow[];
  initialEvents: ClientEventRow[];
  leadOptions: LeadOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [events, setEvents] = useState(initialEvents);
  const [leads, setLeads] = useState(leadOptions);
  const [view, setView] = useState<View>("updates");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [today] = useState(() => todayIL());

  const [toast, setToast] = useState<{ text: string; undoId: string | null } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undoId ? 7000 : 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (m: string, undoFor: string | null = null) => setToast({ text: m, undoId: undoFor });
  const replaceRow = (c: ClientRow) => setRows((rs) => rs.map((r) => (r.id === c.id ? c : r)));
  const addEvents = (...e: ClientEventRow[]) => setEvents((es) => [...e, ...es]);

  async function advance(c: ClientRow) {
    setBusy(true);
    const res = await advanceClientAction(c.id);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.client);
    addEvents(res.event);
    say(res.event.text, c.id);
  }
  async function undo(c: ClientRow) {
    setBusy(true);
    const res = await undoClientActionAction(c.id);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.client);
    setEvents((es) => es.filter((e) => e.id !== res.removedEventId));
    say("הפעולה בוטלה");
  }
  async function milestone(c: ClientRow, key: string) {
    setBusy(true);
    const res = await milestoneAction(c.id, key);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.client);
    addEvents(res.event);
    say(res.event.text, c.id);
  }
  async function sent(c: ClientRow) {
    setBusy(true);
    const res = await updateSentAction(c.id, c.pendingMessage ?? undefined);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.client);
    addEvents(res.event);
    say("סומן שנשלח", c.id);
  }
  async function patch(c: ClientRow, p: Record<string, unknown>) {
    const res = await updateClientAction(c.id, p);
    if (!res.ok) return say(res.error);
    replaceRow(res.client);
    addEvents(...res.events);
  }

  const active = rows.filter((r) => r.status === "active");
  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;

  const stageLine = (c: ClientRow) => {
    const st = stageOf(c.process, c.stageIndex);
    return `${processOf(c.process).label} · ${c.status === "completed" ? "הושלם" : st?.label ?? ""}`;
  };
  const lateChip = (c: ClientRow) => {
    const late = c.status === "active" ? daysLate(c.stageDueAt, today) : 0;
    if (late > 0) return <Chip tone="bg-rose-100 text-rose-700">{`בעיכוב ${late} י׳ (יעד ${fmt(c.stageDueAt)})`}</Chip>;
    return c.status === "active" && c.stageDueAt ? <Chip>{`יעד ${fmt(c.stageDueAt)}`}</Chip> : null;
  };

  const clientCard = (c: ClientRow) => (
    <div key={c.id} className={`${box} mb-2`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 cursor-pointer" onClick={() => setOpenId(c.id)}>
          <div className="font-bold">{c.name}</div>
          <div className="text-sm text-foreground/70">{stageLine(c)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.pendingMessage && <Chip tone="bg-amber-100 text-amber-800">מחכה לעדכון</Chip>}
          {lateChip(c)}
        </div>
      </div>
      <div className="mt-2"><Progress c={c} /></div>
      {c.status === "active" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button disabled={busy} onClick={() => advance(c)} className="rounded-lg bg-button px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50">השלב הושלם</button>
          {milestonesFor(stageOf(c.process, c.stageIndex)?.key).map((m) => (
            <button key={m.key} disabled={busy} onClick={() => milestone(c, m.key)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary">{m.label}</button>
          ))}
          <button onClick={() => setOpenId(c.id)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary">פרטים</button>
        </div>
      )}
    </div>
  );

  const updatesView = () => {
    const pending = active.filter((c) => c.pendingMessage);
    const late = active.filter((c) => !c.pendingMessage && daysLate(c.stageDueAt, today) > 0);
    return (
      <>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-primary">מחכים לעדכון <Chip>{pending.length}</Chip></h2>
          {pending.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-foreground/60">אין עדכונים שממתינים. כשתסמן &quot;השלב הושלם&quot; או אבן דרך, ההודעה המתאימה תופיע כאן.</div>}
          {pending.map((c) => (
            <div key={c.id} className={`${box} mb-3`}>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-sm text-foreground/70">{stageLine(c)}</div>
                </div>
                {lateChip(c)}
              </div>
              <MessageBox key={`${c.id}:${c.pendingMessage}`} client={c} messageKey={currentMessageKey(c)} onSent={() => sent(c)} say={say} busy={busy} />
            </div>
          ))}
        </section>
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-primary">בעיכוב מול היעד <Chip>{late.length}</Chip></h2>
          {late.length === 0 && <div className="text-sm text-foreground/60">אין שלבים בעיכוב.</div>}
          {late.map(clientCard)}
        </section>
      </>
    );
  };

  const listView = (list: ClientRow[], empty: string) => (
    <>
      {list.map(clientCard)}
      {list.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-8 text-center text-foreground/60">{empty}</div>}
    </>
  );

  const body =
    view === "updates" ? updatesView()
    : view === "active" ? listView(active, "אין לקוחות פעילים. הוסף לקוח עם \"+ לקוח חדש\".")
    : view === "done" ? listView(rows.filter((r) => r.status === "completed"), "עדיין אין תיקים שהושלמו.")
    : listView(rows.filter((r) => r.status === "archived"), "הארכיון ריק.");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="ml-2 text-xl font-bold text-primary">לקוחות</h1>
        <div className="flex max-w-full flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${view === v.id ? "bg-primary text-white" : "text-primary hover:bg-primary/5"}`}>
              {v.label}
              {v.id === "updates" && active.some((c) => c.pendingMessage) ? ` (${active.filter((c) => c.pendingMessage).length})` : ""}
            </button>
          ))}
        </div>
        <button className={`${btn} mr-auto`} onClick={() => { setOpenId(null); setAdding(true); }}>+ לקוח חדש</button>
      </div>

      {body}

      {adding && (
        <AddForm
          leads={leads}
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            const res = await createClientAction(input);
            if (!res.ok) return say(res.error);
            setRows((rs) => [res.client, ...rs]);
            addEvents(res.event);
            if (res.client.leadId) setLeads((ls) => ls.filter((l) => l.id !== res.client.leadId));
            setAdding(false);
            setView("updates");
            say("נפתח תיק לקוח");
          }}
        />
      )}
      {open && (
        <Drawer
          key={`${open.id}:${open.process}:${open.stageIndex}:${open.status}`}
          c={open}
          events={events.filter((e) => e.clientId === open.id)}
          busy={busy}
          today={today}
          onClose={() => setOpenId(null)}
          undo={() => undo(open)}
          advance={() => advance(open)}
          milestone={(k) => milestone(open, k)}
          sent={() => sent(open)}
          patch={(p) => patch(open, p)}
          addNote={async (t) => {
            const res = await addClientNoteAction(open.id, t);
            if (!res.ok) return say(res.error);
            addEvents(res.event);
          }}
          say={say}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center md:bottom-6">
          <span className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary px-4 py-2 text-sm text-white shadow-lg">
            {toast.text}
            {toast.undoId && (
              <button onClick={() => { const c = rows.find((r) => r.id === toast.undoId); if (c) void undo(c); }} className="rounded-full bg-white/20 px-3 py-0.5 font-bold">בטל</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Detail drawer ──

function Drawer({
  c, events, busy, today, onClose, undo, advance, milestone, sent, patch, addNote, say,
}: {
  c: ClientRow;
  events: ClientEventRow[];
  busy: boolean;
  today: string;
  onClose: () => void;
  undo: () => void;
  advance: () => void;
  milestone: (key: string) => void;
  sent: () => void;
  patch: (p: Record<string, unknown>) => void;
  addNote: (t: string) => Promise<void>;
  say: (m: string, undoFor?: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const [tplKey, setTplKey] = useState(currentMessageKey(c));
  const proc = processOf(c.process);
  const late = c.status === "active" ? daysLate(c.stageDueAt, today) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-primary">{c.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip>{proc.label}</Chip>
              <Chip tone={c.status === "completed" ? "bg-emerald-100 text-emerald-800" : undefined}>{CLIENT_STATUS_LABELS[c.status]}</Chip>
              {late > 0 && <Chip tone="bg-rose-100 text-rose-700">{`בעיכוב ${late} י׳`}</Chip>}
            </div>
          </div>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>

        <div className="mb-3"><Progress c={c} /></div>
        {c.status === "active" && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button disabled={busy} className={btn} onClick={advance}>השלב הושלם</button>
            {milestonesFor(stageOf(c.process, c.stageIndex)?.key).map((m) => (
              <button key={m.key} disabled={busy} className={ghost} onClick={() => milestone(m.key)}>{m.label}</button>
            ))}
          </div>
        )}

        {events.some((e) => e.undoable) && (
          <div className="mb-3">
            <button disabled={busy} className={ghost} onClick={undo}>בטל פעולה אחרונה</button>
          </div>
        )}

        <MessageBox key={`${c.pendingMessage}:${tplKey}`} client={c} messageKey={tplKey} onSent={c.pendingMessage && tplKey === c.pendingMessage ? sent : undefined} say={say} busy={busy} />
        <div className="mb-4 mt-2">
          <select value={tplKey} onChange={(e) => setTplKey(e.target.value)} className={`${field} w-auto max-w-full`} aria-label="בחר הודעה אחרת">
            {ALL_MESSAGES.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
          </select>
        </div>

        <div className={`${box} mb-4 grid gap-2 md:grid-cols-2`}>
          <label className="block text-xs text-foreground/60">
            סוג התהליך
            <select value={c.process} onChange={(e) => patch({ process: e.target.value as ProcessKey })} className={`${field} mt-0.5 text-foreground`}>
              {PROCESS_KEYS.map((k) => <option key={k} value={k}>{PROCESSES[k].label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-foreground/60">
            שלב נוכחי
            <select value={c.stageIndex} onChange={(e) => patch({ stageIndex: Number(e.target.value) })} className={`${field} mt-0.5 text-foreground`}>
              {proc.stages.map((s, i) => <option key={s.key + i} value={i}>{`${i + 1}. ${s.label}`}</option>)}
            </select>
          </label>
          <label className="block text-xs text-foreground/60">
            יעד לסיום השלב
            <input type="date" defaultValue={c.stageDueAt ?? ""} onChange={(e) => patch({ stageDueAt: e.target.value || null })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            סטטוס
            <select value={c.status} onChange={(e) => patch({ status: e.target.value })} className={`${field} mt-0.5 text-foreground`}>
              {Object.entries(CLIENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-xs text-foreground/60">
            שם
            <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patch({ name: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            טלפון
            <input defaultValue={c.phone ?? ""} inputMode="tel" onBlur={(e) => e.target.value !== (c.phone ?? "") && patch({ phone: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="col-span-full block text-xs text-foreground/60">
            הערות (בלי פרטים פיננסיים. אלה נשארים ב-Smart NPV)
            <textarea defaultValue={c.notes} rows={3} onBlur={(e) => e.target.value !== c.notes && patch({ notes: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
        </div>

        <h3 className="mb-2 font-bold text-primary">היסטוריה</h3>
        <div className="mb-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הוסף הערה…" className={field}
            onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { void addNote(note); setNote(""); } }} />
          <button className={btn} onClick={() => { if (note.trim()) { void addNote(note); setNote(""); } }}>הוסף</button>
        </div>
        <ul className="text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 border-t border-black/5 py-1.5">
              <time className="w-12 shrink-0 text-xs text-foreground/50">{fmt(todayIL(new Date(e.at)))}</time>
              <span>{e.text}</span>
            </li>
          ))}
          {events.length === 0 && <li className="text-foreground/50">אין עדיין היסטוריה.</li>}
        </ul>
      </div>
    </div>
  );
}

// ── New client ──

function AddForm({
  leads, onClose, onCreate,
}: {
  leads: LeadOption[];
  onClose: () => void;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>({ process: "second_hand_tabu" });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const pickLead = (id: string) => {
    const l = leads.find((x) => x.id === id);
    setV((s) => ({ ...s, leadId: id, ...(l ? { name: l.name, phone: l.phone ?? "" } : {}) }));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">לקוח חדש</h2>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>
        <div className="grid gap-2">
          {leads.length > 0 && (
            <label className="block text-xs text-foreground/60">
              מתוך ליד קיים (אופציונלי)
              <select value={v.leadId ?? ""} onChange={(e) => pickLead(e.target.value)} className={`${field} mt-0.5 text-foreground`}>
                <option value="">—</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
          <label className="block text-xs text-foreground/60">
            שם
            <input value={v.name ?? ""} onChange={set("name")} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            טלפון
            <input value={v.phone ?? ""} onChange={set("phone")} inputMode="tel" className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            סוג התהליך
            <select value={v.process} onChange={set("process")} className={`${field} mt-0.5 text-foreground`}>
              {PROCESS_KEYS.map((k) => <option key={k} value={k}>{PROCESSES[k].label}</option>)}
            </select>
          </label>
        </div>
        <button className={`${btn} mt-4`} disabled={saving || !(v.name ?? "").trim()}
          onClick={async () => { setSaving(true); await onCreate({ name: v.name, phone: v.phone || null, process: v.process, leadId: v.leadId || null }); setSaving(false); }}>
          פתח תיק
        </button>
        <div className="mt-2 text-xs text-foreground/60">ליד שנבחר יעבור לשלב &quot;לקוח&quot; בלשונית הלידים.</div>
      </div>
    </div>
  );
}
