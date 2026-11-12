"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTION_LABELS,
  BOARD_COLUMNS,
  DAILY_CAP,
  KIND_LABELS,
  PARTNER_KINDS,
  PARTNER_STAGES,
  SENT_EVENT_KINDS,
  STAGE_LABELS,
  TEMPLATES,
  WAVE_LABELS,
  WAVES,
  availableActions,
  diffDays,
  fillTemplate,
  hasPlaceholders,
  hooksFor,
  instagramLink,
  partnerWhatsappLink,
  suggestTemplate,
  templateById,
  todayIL,
  addDays,
  type PartnerAction,
  type PartnerKind,
  type PartnerStage,
} from "@/lib/partners";
import { addPartnerNoteAction, createPartnerAction, importPartnersAction, performPartnerAction, undoPartnerActionAction, updatePartnerAction } from "./actions";
import type { PartnerEventRow, PartnerRow } from "./types";

type View = "today" | "board" | "list" | "visits" | "templates" | "hooks" | "archive";
type KindFilter = PartnerKind | "all";

const VIEWS: { id: View; label: string }[] = [
  { id: "today", label: "היום" },
  { id: "board", label: "צנרת" },
  { id: "list", label: "כל השותפים" },
  { id: "visits", label: "ביקורים" },
  { id: "templates", label: "הודעות" },
  { id: "hooks", label: "מה עובד" },
  { id: "archive", label: "ארכיון" },
];

const LAUNCH = { date: "2026-11-20", label: "השקת KEDEM TOWER (הכרמל 76, שישי 09:00–14:00)" };

const field = "w-full rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-sm";
const btn = "rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const ghost = "rounded-lg border border-black/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/5";
const box = "rounded-xl border border-black/5 bg-surface p-3 shadow-sm";

const STAGE_TONE: Record<PartnerStage, string> = {
  cold: "bg-slate-100 text-slate-700",
  warm: "bg-sky-100 text-sky-800",
  sent: "bg-indigo-100 text-indigo-800",
  remind: "bg-indigo-100 text-indigo-800",
  replied: "bg-amber-100 text-amber-800",
  meeting: "bg-amber-100 text-amber-800",
  met: "bg-violet-100 text-violet-800",
  visited: "bg-violet-100 text-violet-800",
  coupon: "bg-emerald-100 text-emerald-800",
  partner: "bg-emerald-200 text-emerald-900",
  quiet: "bg-slate-100 text-slate-600",
  dead: "bg-rose-100 text-rose-700",
};

const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

function Chip({ children, tone = "bg-slate-100 text-slate-700" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>;
}

function dueChip(p: PartnerRow, today: string) {
  if (!p.nextAt) return null;
  const d = diffDays(p.nextAt, today);
  if (d < 0) return <Chip tone="bg-rose-100 text-rose-700">{`באיחור ${-d} י׳ (${fmt(p.nextAt)})`}</Chip>;
  if (d === 0) return <Chip tone="bg-amber-100 text-amber-800">היום</Chip>;
  if (d <= 7) return <Chip tone="bg-emerald-100 text-emerald-800">{`בעוד ${d} י׳ (${fmt(p.nextAt)})`}</Chip>;
  return <Chip>{fmt(p.nextAt)}</Chip>;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function PartnersApp({
  initialRows,
  initialEvents,
}: {
  initialRows: PartnerRow[];
  initialEvents: PartnerEventRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState<View>("today");
  const [kind, setKind] = useState<KindFilter>("broker");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
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
  const replaceRow = (p: PartnerRow) => setRows((rs) => rs.map((r) => (r.id === p.id ? p : r)));

  async function run(id: string, action: PartnerAction) {
    setBusy(true);
    const res = await performPartnerAction(id, action);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.partner);
    setEvents((e) => [res.event, ...e]);
    say(res.event.text, id);
  }
  async function undo(id: string) {
    setBusy(true);
    const res = await undoPartnerActionAction(id);
    setBusy(false);
    if (!res.ok) return say(res.error);
    replaceRow(res.partner);
    setEvents((es) => es.filter((e) => e.id !== res.removedEventId));
    say("הפעולה בוטלה");
  }
  async function patch(id: string, p: Record<string, unknown>) {
    const res = await updatePartnerAction(id, p);
    if (!res.ok) return say(res.error);
    replaceRow(res.partner);
  }
  async function addNote(id: string, text: string) {
    const res = await addPartnerNoteAction(id, text);
    if (!res.ok) return say(res.error);
    setEvents((e) => [res.event, ...e]);
  }

  async function importFile(file: File) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return say("הקובץ אינו JSON תקין");
    }
    setBusy(true);
    const res = await importPartnersAction(data);
    setBusy(false);
    if (!res.ok) return say(res.error);
    setRows((rs) => [...res.partners, ...rs]);
    setEvents((e) => [...res.events, ...e]);
    say(`יובאו ${res.created}, דולגו ${res.skipped} (כבר קיימים)`);
  }

  const importButton = (
    <label className={`${ghost} inline-block cursor-pointer`}>
      ייבוא מקובץ JSON
      <input
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
    </label>
  );

  const live = useMemo(() => rows.filter((r) => !r.archived), [rows]);
  const byKind = (list: PartnerRow[]) => (kind === "all" ? list : list.filter((r) => r.kind === kind));
  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;
  const sentToday = events.filter((e) => (SENT_EVENT_KINDS as string[]).includes(e.kind) && todayIL(new Date(e.at)) === today).length;

  const quickButtons = (p: PartnerRow) => {
    return (
      <div className="flex flex-wrap gap-1.5">
        {availableActions(p.kind, p.stage).map((a) => (
          <button
            key={a}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              void run(p.id, a);
            }}
            className={
              a === "stop"
                ? "rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs text-rose-700"
                : ["sentMsg", "visit", "afterVisit", "met", "meetingSet", "sentReminder"].includes(a)
                  ? "rounded-lg bg-button px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  : "rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary"
            }
          >
            {ACTION_LABELS[a]}
          </button>
        ))}
        <button onClick={() => setOpenId(p.id)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary">
          הערה
        </button>
      </div>
    );
  }

  const kindTabs = () => (
    <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-black/10 bg-surface text-sm">
      {([...PARTNER_KINDS, "all"] as KindFilter[]).map((k) => (
        <button
          key={k}
          onClick={() => setKind(k)}
          className={`whitespace-nowrap px-3 py-1.5 ${kind === k ? "bg-primary text-white" : "text-primary"}`}
        >
          {k === "all" ? "הכול" : k === "broker" ? "מתווכים" : k === "sales" ? "משרדי מכירות" : "משרדי תיווך"}
        </button>
      ))}
    </div>
  );

  const partnerCard = (p: PartnerRow) => {
    return (
      <div key={p.id} onClick={() => setOpenId(p.id)} className="mb-2 cursor-pointer rounded-lg border border-black/5 bg-surface p-2.5 shadow-sm hover:border-button">
        <div className="text-sm font-bold">{p.name}</div>
        <div className="text-xs text-foreground/60">{p.nextAction || p.org || p.area || p.address || ""}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {dueChip(p, today)}
          <Chip tone={STAGE_TONE[p.stage]}>{STAGE_LABELS[p.stage]}</Chip>
          {p.wave && <Chip>{WAVE_LABELS[p.wave] ?? p.wave}</Chip>}
          {p.priority && <Chip tone={p.priority === "גבוהה" ? "bg-emerald-100 text-emerald-800" : undefined}>{p.priority}</Chip>}
        </div>
      </div>
    );
  }

  // ── Views ──

  const todayView = () => {
    const items = live
      .filter((p) => p.nextAt && p.stage !== "dead")
      .sort((a, b) => (a.nextAt as string).localeCompare(b.nextAt as string));
    const over = items.filter((p) => (p.nextAt as string) < today);
    const now = items.filter((p) => p.nextAt === today);
    const week = items.filter((p) => (p.nextAt as string) > today && (p.nextAt as string) <= addDays(today, 7));
    const cnt = (f: (p: PartnerRow) => boolean) => live.filter(f).length;
    const dl = diffDays(LAUNCH.date, today);
    const section = (title: string, list: PartnerRow[], empty: string) => (
      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-primary">
          {title} <Chip>{list.length}</Chip>
        </h2>
        <div className={box}>
          {list.length === 0 && <div className="text-sm text-foreground/60">{empty}</div>}
          {list.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 border-t border-black/5 py-3 first:border-t-0 md:flex-row md:items-start">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setOpenId(p.id)}>
                <div className="font-bold">
                  {p.name} <Chip>{KIND_LABELS[p.kind]}</Chip> {p.wave && <Chip>{WAVE_LABELS[p.wave] ?? p.wave}</Chip>}
                </div>
                <div className="text-sm text-foreground/70">
                  {p.nextAction || "ללא פעולה מוגדרת"}
                  {p.org ? ` · ${p.org}` : ""}
                  {p.area ? ` · ${p.area}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {dueChip(p, today)}
                  <Chip tone={STAGE_TONE[p.stage]}>{STAGE_LABELS[p.stage]}</Chip>
                  {p.phone && <bdi dir="ltr" className="text-xs">{p.phone}</bdi>}
                </div>
              </div>
              {quickButtons(p)}
            </div>
          ))}
        </div>
      </section>
    );
    return (
      <>
        {dl >= 0 && dl <= 14 && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <b className="text-xl text-amber-800">{dl === 0 ? "היום" : `${dl} ימים`}</b> · {LAUNCH.label}
            <div className="text-sm text-foreground/70">עידן שוורץ ואלי יונוסוב כבר בגל 1. כדאי להודיע להם לפני.</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className={box}>
            <div className="text-xl font-bold">{sentToday} / {DAILY_CAP}</div>
            <div className="text-xs text-foreground/60">הודעות שנשלחו היום</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-black/10">
              <div className="h-full bg-button" style={{ width: `${Math.min(100, (sentToday / DAILY_CAP) * 100)}%` }} />
            </div>
          </div>
          <div className={box}><div className="text-xl font-bold">{cnt((p) => p.stage === "warm")}</div><div className="text-xs text-foreground/60">בחימום</div></div>
          <div className={box}><div className="text-xl font-bold">{cnt((p) => p.stage === "sent" || p.stage === "remind")}</div><div className="text-xs text-foreground/60">ממתינים למענה</div></div>
          <div className={box}><div className="text-xl font-bold">{cnt((p) => ["replied", "meeting", "met"].includes(p.stage))}</div><div className="text-xs text-foreground/60">בשיחה / פגישה</div></div>
          <div className={box}><div className="text-xl font-bold">{cnt((p) => p.stage === "coupon" || p.stage === "partner")}</div><div className="text-xs text-foreground/60">קופון / שיתוף</div></div>
        </div>
        {section("באיחור", over, "אין משימות באיחור.")}
        {section("היום", now, "אין משימות להיום.")}
        {section("7 הימים הקרובים", week, "אין משימות מתוכננות לשבוע הקרוב.")}
      </>
    );
  };

  const boardView = () => {
    const src = byKind(live).filter((p) => p.stage !== "dead");
    return (
      <>
        <div className="mb-3">{kindTabs()}</div>
        <div className="grid items-start gap-3 md:grid-cols-2">
          {BOARD_COLUMNS.map((c) => {
            const list = src.filter((p) => c.stages.includes(p.stage)).sort((a, b) => (a.nextAt ?? "9").localeCompare(b.nextAt ?? "9"));
            return (
              <details key={c.title} open={list.length > 0 && !c.stages.includes("cold")} className={box}>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-primary">
                  <span>{c.title}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-foreground/70">{list.length}</span>
                </summary>
                <div className="mt-3">
                  {list.map((p) => partnerCard(p))}
                  {list.length === 0 && <div className="text-xs text-foreground/50">ריק</div>}
                </div>
              </details>
            );
          })}
        </div>
      </>
    );
  };

  const listView = () => {
    let list = byKind(live);
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((p) => [p.name, p.org, p.instagram, p.phone, p.area, p.address, p.notes].join(" ").toLowerCase().includes(t));
    if (statusF) list = list.filter((p) => p.stage === statusF);
    list = [...list].sort((a, b) => (a.nextAt ?? "9").localeCompare(b.nextAt ?? "9") || a.name.localeCompare(b.name, "he"));
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {kindTabs()}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם, טלפון, אזור…" className={`${field} md:w-56`} />
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={`${field} md:w-48`}>
            <option value="">כל הסטטוסים</option>
            {PARTNER_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <span className="text-sm text-foreground/60">{list.length} שותפים</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => partnerCard(p))}
        </div>
        {list.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-8 text-center text-foreground/60">אין שותפים בסינון הזה.</div>}
      </>
    );
  };

  const visitsView = () => {
    const a = live.filter((p) => p.kind !== "broker" && p.stage !== "dead");
    const prio: Record<string, number> = { "גבוהה": 0, "בינונית": 1, "נמוכה": 2 };
    const groups: [string, PartnerRow[]][] = [
      ["משרדי מכירות ופרויקטים", a.filter((p) => p.kind === "sales")],
      ["מסלול הרצל", a.filter((p) => p.route === "מסלול הרצל")],
      ["מרכז העיר", a.filter((p) => p.route === "מרכז העיר")],
      ["פזור", a.filter((p) => p.route === "פזור")],
      ["לאתר כתובת", a.filter((p) => p.kind === "office" && p.route === "לאתר כתובת")],
    ];
    return (
      <>
        <p className="mb-2 text-sm text-foreground/70">ביקור פנים אל פנים הוא החימום הטוב ביותר. סמן &quot;ביקרתי&quot;, הוסף הערה מהשטח, והמערכת תתזכר אותך להודעה באותו יום.</p>
        {groups.map(([title, list]) => (
          <section key={title} className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-primary">{title} <Chip>{list.length}</Chip></h2>
            <div className={box}>
              {[...list].sort((x, y) => (prio[x.priority ?? ""] ?? 3) - (prio[y.priority ?? ""] ?? 3)).map((p) => (
                <div key={p.id} className="flex flex-col gap-2 border-t border-black/5 py-3 first:border-t-0 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setOpenId(p.id)}>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-sm text-foreground/60">{[p.address, p.org].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {p.priority && <Chip tone={p.priority === "גבוהה" ? "bg-emerald-100 text-emerald-800" : undefined}>{p.priority}</Chip>}
                      <Chip tone={STAGE_TONE[p.stage]}>{STAGE_LABELS[p.stage]}</Chip>
                      {dueChip(p, today)}
                      {p.phone && <bdi dir="ltr" className="text-xs">{p.phone}</bdi>}
                    </div>
                  </div>
                  {quickButtons(p)}
                </div>
              ))}
              {list.length === 0 && <div className="text-sm text-foreground/60">אין שורות.</div>}
            </div>
          </section>
        ))}
      </>
    );
  };

  const templatesView = () => {
    const groups = [...new Set(TEMPLATES.map((t) => t.group))];
    return (
      <>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <b>איך הפנייה הקרה הופכת לסקרנות:</b> הודעה ראשונה אחת, קצרה וספציפית לאדם, עם משהו קטן שהוא מקבל או שאלה אחת שקל לענות עליה. בלי להציג את עצמי ובלי לבקש שיתוף פעולה. עד {DAILY_CAP} ביום, שליחה ידנית, ואחרי הודעה ראשונה ופנייה שנייה בלי מענה עוצרים וחוזרים בעוד חודשיים–שלושה עם ווי אחר.
        </div>
        {groups.map((g) => (
          <section key={g} className="mt-5">
            <h2 className="mb-2 text-base font-bold text-primary">{g}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {TEMPLATES.filter((t) => t.group === g).map((t) => (
                <div key={t.id} className={box}>
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">{t.title}</b>
                    <button className={ghost} onClick={async () => say((await copyText(t.body)) ? "הועתק" : "ההעתקה נחסמה. סמן והעתק ידנית")}>העתק</button>
                  </div>
                  {t.prep && <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">להכין: {t.prep}</div>}
                  <p className="mt-2 whitespace-pre-wrap text-sm">{t.body}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </>
    );
  };

  const hooksView = () => {
    const hooks = TEMPLATES.filter((t) => t.hook);
    const stats = hooks.map((h) => {
      const assigned = rows.filter((r) => r.hook === h.id).length;
      const ev = events.filter((e) => e.hook === h.id);
      const sent = new Set(ev.filter((e) => e.kind === "sentMsg" || e.kind === "afterVisit" || e.kind === "visit").map((e) => e.partnerId)).size;
      const replied = new Set(ev.filter((e) => e.kind === "replied").map((e) => e.partnerId)).size;
      return { h, assigned, sent, replied };
    });
    return (
      <>
        <p className="mb-3 text-sm text-foreground/70">מה עובד: כל שותף מקבל ווי פתיחה, וכל תשובה נרשמת כשאתה לוחץ &quot;ענה&quot;. אחרי כ-10 שליחות כבר רואים כיוון. המדגם קטן, אז זה כיוון ולא הוכחה.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {stats.map(({ h, assigned, sent, replied }) => (
            <div key={h.id} className={box}>
              <div className="font-bold">{h.title}</div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-foreground/60">
                <div><div className="text-lg font-bold text-foreground">{assigned}</div>הוקצה</div>
                <div><div className="text-lg font-bold text-foreground">{sent}</div>נשלח</div>
                <div><div className="text-lg font-bold text-foreground">{replied}</div>ענו</div>
                <div><div className="text-lg font-bold text-foreground">{sent ? `${Math.round((replied / sent) * 100)}%` : "—"}</div>מענה</div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const archiveView = () => {
    const list = rows.filter((r) => r.archived || r.stage === "dead");
    return (
      <>
        <div className="mb-3">{importButton}</div>
        <p className="mb-3 text-sm text-foreground/70">שותפים שהוסרו או ביקשו להפסיק. כאן רואים מי ולמה, כדי שלא יחזרו בטעות.</p>
        <div className="grid gap-2">
          {list.map((p) => (
            <div key={p.id} className={`${box} flex items-center justify-between gap-3`}>
              <div className="min-w-0">
                <div className="font-bold">{p.name} <Chip>{KIND_LABELS[p.kind]}</Chip></div>
                <div className="text-sm text-foreground/60">{p.archiveReason || (p.stage === "dead" ? "לא מעוניין / ביקש להפסיק" : "")}</div>
              </div>
              <button className={ghost} onClick={() => patch(p.id, { archived: false, archiveReason: null, ...(p.stage === "dead" ? { stage: "cold" } : {}) })}>החזר</button>
            </div>
          ))}
          {list.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-8 text-center text-foreground/60">הארכיון ריק.</div>}
        </div>
      </>
    );
  };

  const body =
    view === "today" ? todayView() : view === "board" ? boardView() : view === "list" ? listView() :
    view === "visits" ? visitsView() : view === "templates" ? templatesView() : view === "hooks" ? hooksView() : archiveView();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="ml-2 text-xl font-bold text-primary">שותפים</h1>
        <div className="flex max-w-full flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${view === v.id ? "bg-primary text-white" : "text-primary hover:bg-primary/5"}`}>{v.label}</button>
          ))}
        </div>
        <button className={`${btn} mr-auto`} onClick={() => { setOpenId(null); setAdding(true); }}>+ שותף חדש</button>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 p-10 text-center text-foreground/60">
          <b>עדיין אין שותפים במערכת.</b>
          <div className="mt-1 text-sm">הוסף שותף ראשון עם &quot;+ שותף חדש&quot;, או ייבא את הרשימה הקיימת.</div>
          <div className="mt-3">{importButton}</div>
        </div>
      ) : body}

      {adding && (
        <AddForm
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            const res = await createPartnerAction(input);
            if (!res.ok) return say(res.error);
            setRows((rs) => [res.partner, ...rs]);
            setEvents((e) => [res.event, ...e]);
            setAdding(false);
            setOpenId(res.partner.id);
            say("נוסף");
          }}
        />
      )}
      {open && (
        <Drawer
          key={`${open.id}:${open.stage}:${open.hook ?? ""}`}
          p={open}
          events={events.filter((e) => e.partnerId === open.id)}
          busy={busy}
          onClose={() => setOpenId(null)}
          run={run}
          undo={() => undo(open.id)}
          patch={patch}
          addNote={addNote}
          say={say}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center md:bottom-6">
          <span className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary px-4 py-2 text-sm text-white shadow-lg">
            {toast.text}
            {toast.undoId && (
              <button onClick={() => undo(toast.undoId as string)} className="rounded-full bg-white/20 px-3 py-0.5 font-bold">בטל</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Detail drawer ──

function Drawer({
  p, events, busy, onClose, run, undo, patch, addNote, say,
}: {
  p: PartnerRow;
  events: PartnerEventRow[];
  busy: boolean;
  onClose: () => void;
  run: (id: string, a: PartnerAction) => Promise<void>;
  undo: () => void;
  patch: (id: string, v: Record<string, unknown>) => Promise<void>;
  addNote: (id: string, text: string) => Promise<void>;
  say: (m: string, undoFor?: string | null) => void;
}) {
  const suggested = suggestTemplate({ kind: p.kind, stage: p.stage, hook: p.hook });
  const [tplId, setTplId] = useState(suggested);
  const [text, setText] = useState(() => fillTemplate(templateById(suggested)?.body ?? "", p.name));
  const [note, setNote] = useState("");
  const [why, setWhy] = useState("");
  const tpl = templateById(tplId);
  const wa = partnerWhatsappLink(p.phone, text);
  const ig = instagramLink(p.instagram);
  const options = TEMPLATES.filter((t) => (p.kind === "broker" ? t.group.startsWith("מתווכים") : t.group.startsWith("משרדי")));
  const hooks = hooksFor(p.kind);

  const text1 = (k: keyof PartnerRow, label: string) => (
    <label className="block text-xs text-foreground/60">
      {label}
      <input
        defaultValue={(p[k] as string | null) ?? ""}
        onBlur={(e) => e.target.value !== ((p[k] as string | null) ?? "") && void patch(p.id, { [k]: e.target.value })}
        className={`${field} mt-0.5 text-foreground`}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-primary">{p.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip>{KIND_LABELS[p.kind]}</Chip>
              <Chip tone={STAGE_TONE[p.stage]}>{STAGE_LABELS[p.stage]}</Chip>
              {p.wave && <Chip>{WAVE_LABELS[p.wave] ?? p.wave}</Chip>}
              {p.priority && <Chip>{p.priority}</Chip>}
            </div>
          </div>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {ig && <a className={ghost} href={ig} target="_blank" rel="noopener noreferrer">אינסטגרם</a>}
          {wa && <a className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-slate-900" href={wa} target="_blank" rel="noopener noreferrer">וואטסאפ עם ההודעה</a>}
          {p.phone && <button className={ghost} onClick={async () => say((await copyText(p.phone as string)) ? "הועתק" : "ההעתקה נחסמה")}>העתק טלפון</button>}
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {availableActions(p.kind, p.stage).map((a) => (
            <button key={a} disabled={busy} onClick={() => void run(p.id, a)}
              className={a === "stop" ? "rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-700" : "rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"}>
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        {events.some((e) => e.undoable) && (
          <div className="mb-3">
            <button disabled={busy} className={ghost} onClick={undo}>בטל פעולה אחרונה</button>
          </div>
        )}

        <div className={`${box} mb-4 grid gap-2 md:grid-cols-2`}>
          <label className="col-span-full block text-xs text-foreground/60">
            פעולה הבאה
            <input defaultValue={p.nextAction ?? ""} onBlur={(e) => e.target.value !== (p.nextAction ?? "") && void patch(p.id, { nextAction: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            מועד
            <input type="date" defaultValue={p.nextAt ?? ""} onChange={(e) => void patch(p.id, { nextAt: e.target.value || null })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            סטטוס
            <select value={p.stage} onChange={(e) => void patch(p.id, { stage: e.target.value })} className={`${field} mt-0.5 text-foreground`}>
              {PARTNER_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          {hooks.length > 0 && (
            <label className="col-span-full block text-xs text-foreground/60">
              ווי הפתיחה (לבדיקת מה עובד)
              <select value={p.hook ?? ""} onChange={(e) => void patch(p.id, { hook: e.target.value || null })} className={`${field} mt-0.5 text-foreground`}>
                <option value="">ברירת מחדל</option>
                {hooks.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="text-xs text-foreground/60">הודעה מוצעת (אפשר לערוך לפני שליחה)</div>
        {tpl?.prep && <div className="my-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">להכין: {tpl.prep}</div>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${field} mt-1 leading-relaxed`} />
        {hasPlaceholders(text) && <div className="mt-1 text-xs text-rose-700">יש בהודעה סוגריים מרובעים. השלם אותם בפרט אמיתי לפני שליחה.</div>}
        <div className="mb-4 mt-2 flex flex-wrap gap-2">
          <select
            value={tplId}
            onChange={(e) => { setTplId(e.target.value); setText(fillTemplate(templateById(e.target.value)?.body ?? "", p.name)); }}
            className={`${field} w-auto max-w-full`}
          >
            {options.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button className={btn} onClick={async () => say((await copyText(text)) ? "הועתק" : "ההעתקה נחסמה. סמן והעתק ידנית")}>העתק הודעה</button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {text1("name", "שם")}{text1("org", "משרד / יזם")}{text1("instagram", "אינסטגרם")}{text1("phone", "טלפון")}{text1("area", "אזור")}{text1("address", "כתובת")}
          <label className="block text-xs text-foreground/60">
            גל
            <select value={p.wave ?? ""} onChange={(e) => void patch(p.id, { wave: e.target.value || null })} className={`${field} mt-0.5 text-foreground`}>
              <option value="">—</option>
              {WAVES.map((w) => <option key={w} value={w}>{WAVE_LABELS[w]}</option>)}
            </select>
          </label>
          <label className="col-span-full block text-xs text-foreground/60">
            הערות
            <textarea defaultValue={p.notes} rows={3} onBlur={(e) => e.target.value !== p.notes && void patch(p.id, { notes: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
        </div>

        <h3 className="mb-2 mt-5 font-bold text-primary">היסטוריה והערות מהשטח</h3>
        <div className="mb-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הוסף הערה…" className={field}
            onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { void addNote(p.id, note); setNote(""); } }} />
          <button className={btn} onClick={() => { if (note.trim()) { void addNote(p.id, note); setNote(""); } }}>הוסף</button>
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

        <div className="mt-5 flex gap-2">
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="סיבה להסרה (אופציונלי)" className={field} />
          <button className="whitespace-nowrap rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-700"
            onClick={async () => { await patch(p.id, { archived: true, archiveReason: why || "הוסר ידנית" }); onClose(); }}>
            העבר לארכיון
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick add (also used in the field) ──

function AddForm({ onClose, onCreate }: { onClose: () => void; onCreate: (input: Record<string, unknown>) => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({ kind: "broker" });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const f = (k: string, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block text-xs text-foreground/60">
      {label}
      <input value={v[k] ?? ""} onChange={set(k)} className={`${field} mt-0.5 text-foreground`} {...extra} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">שותף חדש מהשטח</h2>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="col-span-full block text-xs text-foreground/60">
            סוג
            <select value={v.kind} onChange={set("kind")} className={`${field} mt-0.5 text-foreground`}>
              {PARTNER_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          {f("name", "שם")}{f("phone", "טלפון", { inputMode: "tel" })}{f("org", "משרד / יזם")}{f("instagram", "אינסטגרם")}{f("area", "אזור")}{f("address", "כתובת")}
          <label className="col-span-full block text-xs text-foreground/60">
            הערה
            <textarea value={v.notes ?? ""} onChange={set("notes")} rows={3} className={`${field} mt-0.5 text-foreground`} />
          </label>
        </div>
        <button className={`${btn} mt-4`} disabled={saving || !(v.name ?? "").trim()}
          onClick={async () => { setSaving(true); await onCreate({ ...v, notes: v.notes ?? "" }); setSaving(false); }}>
          הוסף
        </button>
      </div>
    </div>
  );
}
