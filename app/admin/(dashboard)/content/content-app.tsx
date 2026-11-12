"use client";

import { useEffect, useState } from "react";
import {
  CONTENT_FORMATS,
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  FORMAT_LABELS,
  METRIC_KEYS,
  METRIC_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  contentLink,
  engagementRate,
  summarize,
  type ContentFormat,
  type ContentPlatform,
  type ContentStatus,
  type GroupStat,
} from "@/lib/content";
import { addDays, diffDays, todayIL } from "@/lib/partners";
import { createContentAction, deleteContentAction, importDraftsAction, readScreenshotAction, updateContentAction } from "./actions";
import type { ContentRow } from "./types";

type View = "board" | "published" | "insights";
const VIEWS: { id: View; label: string }[] = [
  { id: "board", label: "לוח" },
  { id: "published", label: "פורסמו" },
  { id: "insights", label: "מה עובד" },
];

const field = "w-full rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-sm";
const btn = "rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const ghost = "rounded-lg border border-black/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/5";
const box = "rounded-xl border border-black/5 bg-surface p-3 shadow-sm";

const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null | undefined) => (x === null || x === undefined ? "—" : Math.round(x).toLocaleString("he-IL"));
const label = <T extends string>(map: Record<T, string>, k: string) => (map as Record<string, string>)[k] ?? k;

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

export default function ContentApp({ initialRows, leadCounts, initialOpenId = null }: { initialRows: ContentRow[]; leadCounts: Record<string, number>; initialOpenId?: string | null }) {
  const [rows, setRows] = useState(initialRows);
  const [view, setView] = useState<View>("board");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [today] = useState(() => todayIL());

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (m: string) => setToast(m);
  const replaceRow = (c: ContentRow) => setRows((rs) => rs.map((r) => (r.id === c.id ? c : r)));

  async function patch(id: string, p: Record<string, unknown>) {
    const res = await updateContentAction(id, p);
    if (!res.ok) return say(res.error);
    replaceRow(res.content);
  }
  async function importDrafts() {
    setBusy(true);
    const res = await importDraftsAction();
    setBusy(false);
    if (!res.ok) return say(res.error);
    setRows((rs) => [...res.items, ...rs]);
    say(res.items.length ? `יובאו ${res.items.length} פוסטים שפורסמו` : "אין פוסטים חדשים לייבא");
  }

  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;
  const lc = (c: ContentRow) => leadCounts[c.code] ?? 0;

  const itemCard = (c: ContentRow) => {
    const late = c.status === "planned" && c.plannedAt && diffDays(c.plannedAt, today) < 0;
    return (
      <div key={c.id} className={`${box} mb-2`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 cursor-pointer" onClick={() => setOpenId(c.id)}>
            <div className="font-bold">{c.title}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip>{label(PLATFORM_LABELS, c.platform)}</Chip>
              <Chip>{label(FORMAT_LABELS, c.format)}</Chip>
              {c.topic && <Chip>{c.topic}</Chip>}
              {c.plannedAt && c.status !== "published" && (
                <Chip tone={late ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}>{late ? `באיחור (${fmt(c.plannedAt)})` : fmt(c.plannedAt)}</Chip>
              )}
              {c.status === "published" && c.publishedAt && <Chip tone="bg-emerald-100 text-emerald-800">{`פורסם ${fmt(c.publishedAt)}`}</Chip>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.status !== "published" && (
              <button className="rounded-lg bg-button px-2.5 py-1.5 text-xs font-medium text-white" onClick={() => patch(c.id, { status: "published" })}>פורסם</button>
            )}
            {c.status === "idea" && (
              <button className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary" onClick={() => patch(c.id, { status: "planned", plannedAt: addDays(today, 1) })}>לתכנן למחר</button>
            )}
            <button className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-primary" onClick={() => setOpenId(c.id)}>פרטים</button>
          </div>
        </div>
        {c.status === "published" && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
            <span>צפיות: <b>{num(c.metrics.views ?? c.metrics.reach)}</b></span>
            <span>לייקים: <b>{num(c.metrics.likes)}</b></span>
            <span>שמירות: <b>{num(c.metrics.saves)}</b></span>
            <span>מעורבות: <b>{pct(engagementRate(c.metrics))}</b></span>
            <span>לידים: <b>{lc(c)}</b></span>
            {Object.keys(c.metrics).length === 0 && (
              <button className="font-bold text-button" onClick={() => setOpenId(c.id)}>העלה צילום ביצועים</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const section = (title: string, list: ContentRow[], empty: string) => (
    <section className="mt-5 first:mt-0">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-primary">
        {title} <Chip>{list.length}</Chip>
      </h2>
      {list.map(itemCard)}
      {list.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-4 text-sm text-foreground/60">{empty}</div>}
    </section>
  );

  const boardView = () => {
    const planned = rows.filter((r) => r.status === "planned").sort((a, b) => (a.plannedAt ?? "9").localeCompare(b.plannedAt ?? "9"));
    const week = planned.filter((r) => r.plannedAt && r.plannedAt <= addDays(today, 7));
    const later = planned.filter((r) => !r.plannedAt || r.plannedAt > addDays(today, 7));
    return (
      <>
        {section("השבוע (כולל באיחור)", week, "אין תוכן מתוכנן לשבוע הקרוב. הוסף תוכן עם \"+ תוכן חדש\".")}
        {section("מתוכנן בהמשך", later, "אין תוכן מתוכנן בהמשך.")}
        {section("רעיונות", rows.filter((r) => r.status === "idea"), "אין רעיונות שמורים.")}
      </>
    );
  };

  const publishedView = () => {
    const list = rows.filter((r) => r.status === "published").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className={ghost} disabled={busy} onClick={importDrafts}>ייבא פוסטים שפורסמו מהטיוטות</button>
          <span className="text-xs text-foreground/60">מי שכבר יובא לא יתווסף שוב.</span>
        </div>
        {list.map(itemCard)}
        {list.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-8 text-center text-foreground/60">עדיין אין תוכן שפורסם.</div>}
      </>
    );
  };

  const insightsView = () => {
    const s = summarize(
      rows.map((r) => ({ id: r.id, title: r.title, platform: r.platform, format: r.format, topic: r.topic, status: r.status, metrics: r.metrics, code: r.code })),
      leadCounts
    );
    const groupCard = (title: string, list: GroupStat[], labeler: (k: string) => string) => (
      <section className="mt-5">
        <h2 className="mb-2 text-base font-bold text-primary">{title}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((g) => (
            <div key={g.key} className={box}>
              <div className="flex items-center justify-between">
                <b>{labeler(g.key)}</b>
                <Chip>{`${g.count} פורסמו`}</Chip>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-foreground/60">
                <div><div className="text-base font-bold text-foreground">{num(g.avgViews)}</div>ממוצע צפיות</div>
                <div><div className="text-base font-bold text-foreground">{pct(g.avgRate)}</div>מעורבות</div>
                <div><div className="text-base font-bold text-foreground">{g.leads}</div>לידים</div>
              </div>
              {g.withMetrics < g.count && <div className="mt-1 text-[11px] text-foreground/50">{`ביצועים ל-${g.withMetrics} מתוך ${g.count}`}</div>}
            </div>
          ))}
          {list.length === 0 && <div className="text-sm text-foreground/60">אין עדיין נתונים.</div>}
        </div>
      </section>
    );
    return (
      <>
        <p className="text-sm text-foreground/70">ההשוואה מתבססת על תוכן שפורסם ויש לו מספרי ביצועים. המדגם קטן בהתחלה, אז זה כיוון ולא הוכחה. כדי שהלידים יירשמו, שים את הקישור עם הקוד של הפריט בביו, בסטורי או בהערה.</p>
        <section className="mt-5">
          <h2 className="mb-2 text-base font-bold text-primary">הכי הרבה צפיות</h2>
          {s.top.map((c) => {
            const row = rows.find((r) => r.id === c.id);
            return (
              <div key={c.id} className={`${box} mb-2 cursor-pointer`} onClick={() => setOpenId(c.id)}>
                <div className="font-bold">{c.title}</div>
                <div className="mt-1 text-xs text-foreground/70">{`${label(PLATFORM_LABELS, c.platform)} · ${label(FORMAT_LABELS, c.format)} · צפיות ${num(c.metrics.views ?? c.metrics.reach)} · מעורבות ${pct(engagementRate(c.metrics))}${row ? ` · לידים ${lc(row)}` : ""}`}</div>
              </div>
            );
          })}
          {s.top.length === 0 && <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-foreground/60">עוד אין תוכן עם ביצועים. פתח פריט שפורסם והעלה צילום של הביצועים שלו.</div>}
        </section>
        {groupCard("לפי פלטפורמה", s.byPlatform, (k) => label(PLATFORM_LABELS, k))}
        {groupCard("לפי סוג תוכן", s.byFormat, (k) => label(FORMAT_LABELS, k))}
        {groupCard("לפי נושא", s.byTopic, (k) => k)}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="ml-2 text-xl font-bold text-primary">מעקב תוכן</h1>
        <div className="flex max-w-full flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${view === v.id ? "bg-primary text-white" : "text-primary hover:bg-primary/5"}`}>{v.label}</button>
          ))}
        </div>
        <button className={`${btn} mr-auto`} onClick={() => { setOpenId(null); setAdding(true); }}>+ תוכן חדש</button>
      </div>

      {view === "board" ? boardView() : view === "published" ? publishedView() : insightsView()}

      {adding && (
        <AddForm
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            const res = await createContentAction(input);
            if (!res.ok) return say(res.error);
            setRows((rs) => [res.content, ...rs]);
            setAdding(false);
            say("התוכן נוסף");
          }}
        />
      )}
      {open && (
        <Drawer
          key={open.id}
          c={open}
          leads={lc(open)}
          onClose={() => setOpenId(null)}
          patch={(p) => patch(open.id, p)}
          replace={replaceRow}
          remove={async () => {
            const res = await deleteContentAction(open.id);
            if (!res.ok) return say(res.error);
            setRows((rs) => rs.filter((r) => r.id !== open.id));
            setOpenId(null);
            say("נמחק");
          }}
          say={say}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center md:bottom-6">
          <span className="rounded-full bg-primary px-4 py-2 text-sm text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── Detail drawer ──

function Drawer({
  c, leads, onClose, patch, replace, remove, say,
}: {
  c: ContentRow;
  leads: number;
  onClose: () => void;
  patch: (p: Record<string, unknown>) => Promise<void>;
  replace: (c: ContentRow) => void;
  remove: () => Promise<void>;
  say: (m: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const link = contentLink({ platform: c.platform, format: c.format, code: c.code });

  const text1 = (k: "title" | "topic" | "url", lab: string) => (
    <label className="block text-xs text-foreground/60">
      {lab}
      <input defaultValue={c[k] ?? ""} onBlur={(e) => e.target.value !== (c[k] ?? "") && void patch({ [k]: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
    </label>
  );
  const sel = (k: "platform" | "format" | "status", lab: string, opts: readonly string[], labels: Record<string, string>) => (
    <label className="block text-xs text-foreground/60">
      {lab}
      <select value={c[k]} onChange={(e) => void patch({ [k]: e.target.value })} className={`${field} mt-0.5 text-foreground`}>
        {opts.map((o) => <option key={o} value={o}>{labels[o] ?? o}</option>)}
      </select>
    </label>
  );

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await readScreenshotAction(c.id, fd);
    setUploading(false);
    if (!res.ok) return say(res.error);
    replace(res.content);
    say(res.found ? `נקראו ${res.found} מספרים מהצילום. בדוק אותם` : "לא זוהו מספרים בצילום. אפשר להזין ידנית");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-primary">{c.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip>{label(PLATFORM_LABELS, c.platform)}</Chip>
              <Chip>{label(FORMAT_LABELS, c.format)}</Chip>
              <Chip tone={c.status === "published" ? "bg-emerald-100 text-emerald-800" : undefined}>{label(STATUS_LABELS, c.status)}</Chip>
              <Chip>{`לידים: ${leads}`}</Chip>
            </div>
          </div>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>

        <div className={`${box} mb-4 grid gap-2 md:grid-cols-2`}>
          {text1("title", "כותרת")}
          {text1("topic", "נושא")}
          {sel("platform", "פלטפורמה", CONTENT_PLATFORMS, PLATFORM_LABELS)}
          {sel("format", "סוג", CONTENT_FORMATS, FORMAT_LABELS)}
          {sel("status", "סטטוס", CONTENT_STATUSES, STATUS_LABELS)}
          {text1("url", "קישור לפוסט")}
          <label className="block text-xs text-foreground/60">
            תאריך מתוכנן
            <input type="date" defaultValue={c.plannedAt ?? ""} onChange={(e) => void patch({ plannedAt: e.target.value || null })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="block text-xs text-foreground/60">
            תאריך פרסום
            <input type="date" defaultValue={c.publishedAt ?? ""} onChange={(e) => void patch({ publishedAt: e.target.value || null })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="col-span-full block text-xs text-foreground/60">
            טקסט / כיתוב
            <textarea defaultValue={c.caption} rows={3} onBlur={(e) => e.target.value !== c.caption && void patch({ caption: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <label className="col-span-full block text-xs text-foreground/60">
            הערות
            <textarea defaultValue={c.notes} rows={2} onBlur={(e) => e.target.value !== c.notes && void patch({ notes: e.target.value })} className={`${field} mt-0.5 text-foreground`} />
          </label>
        </div>

        <div className={`${box} mb-4`}>
          <div className="mb-1 text-xs text-foreground/60">קישור לאתר עם הקוד של הפריט ({c.code}). לידים שנכנסים דרכו נרשמים עליו</div>
          <div className="break-all text-xs" dir="ltr">{link}</div>
          <button className={`${ghost} mt-2`} onClick={async () => say((await copyText(link)) ? "הקישור הועתק" : "ההעתקה נחסמה. סמן והעתק ידנית")}>העתק קישור</button>
        </div>

        <h3 className="mb-2 font-bold text-primary">ביצועים</h3>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {METRIC_KEYS.map((k) => (
            <label key={k} className="block text-xs text-foreground/60">
              {METRIC_LABELS[k]}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={c.metrics[k] ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const cur = c.metrics[k];
                  if ((v === "" && cur === undefined) || (v !== "" && Number(v) === cur)) return;
                  void patch({ metrics: { [k]: v === "" ? null : Number(v) } });
                }}
                className={`${field} mt-0.5 text-foreground`}
              />
            </label>
          ))}
        </div>

        <label className={`${ghost} mb-2 inline-block cursor-pointer ${uploading ? "opacity-60" : ""}`}>
          {uploading ? "קורא את הצילום…" : "העלה צילום ביצועים וקרא ממנו"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
        <div className="text-xs text-foreground/60">המספרים נקראים אוטומטית ואפשר לתקן אותם למעלה. כדאי לבדוק אותם.</div>

        {c.screenshots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.screenshots.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="צילום ביצועים" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        {c.insights && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">
            <div className="mb-1 font-bold text-amber-900">מה אפשר לשפר</div>
            <div className="whitespace-pre-wrap text-amber-950">{c.insights}</div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          {!confirmDelete ? (
            <button className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-700" onClick={() => setConfirmDelete(true)}>מחק</button>
          ) : (
            <>
              <span className="text-sm text-rose-700">למחוק את הפריט?</span>
              <button className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white" onClick={remove}>כן, מחק</button>
              <button className={ghost} onClick={() => setConfirmDelete(false)}>ביטול</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New content ──

function AddForm({ onClose, onCreate }: { onClose: () => void; onCreate: (input: Record<string, unknown>) => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({ platform: "instagram", format: "reel", status: "planned" });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-stretch md:justify-start" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-10 shadow-xl md:max-h-full md:w-[540px] md:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">תוכן חדש</h2>
          <button className={ghost} onClick={onClose}>סגור</button>
        </div>
        <div className="grid gap-2">
          <label className="block text-xs text-foreground/60">
            כותרת או רעיון
            <input value={v.title ?? ""} onChange={set("title")} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-foreground/60">
              פלטפורמה
              <select value={v.platform} onChange={set("platform")} className={`${field} mt-0.5 text-foreground`}>
                {CONTENT_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p as ContentPlatform]}</option>)}
              </select>
            </label>
            <label className="block text-xs text-foreground/60">
              סוג
              <select value={v.format} onChange={set("format")} className={`${field} mt-0.5 text-foreground`}>
                {CONTENT_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f as ContentFormat]}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs text-foreground/60">
            נושא (לצורך ההשוואה)
            <input value={v.topic ?? ""} onChange={set("topic")} className={`${field} mt-0.5 text-foreground`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-foreground/60">
              סטטוס
              <select value={v.status} onChange={set("status")} className={`${field} mt-0.5 text-foreground`}>
                {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s as ContentStatus]}</option>)}
              </select>
            </label>
            <label className="block text-xs text-foreground/60">
              תאריך מתוכנן
              <input type="date" value={v.plannedAt ?? ""} onChange={set("plannedAt")} className={`${field} mt-0.5 text-foreground`} />
            </label>
          </div>
        </div>
        <button className={`${btn} mt-4`} disabled={saving || !(v.title ?? "").trim()}
          onClick={async () => { setSaving(true); await onCreate({ title: v.title, platform: v.platform, format: v.format, status: v.status, topic: v.topic || null, plannedAt: v.plannedAt || null }); setSaving(false); }}>
          הוסף
        </button>
      </div>
    </div>
  );
}
