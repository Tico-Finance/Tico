"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chat from "./chat";
import { Tools, type Tool } from "./tools";
import { ALL_QUESTIONS, SECTIONS, type Phase } from "./data";

type Status = "" | "done" | "partial" | "none";
type Day = {
  keyAction: string;
  keyStatus: Status;
  energy: number;
  focus: number;
  morningDone: boolean;
  anchorDone: boolean;
  identityNote: string;
  closed?: boolean;
  lesson: string;
  gratitude: [string, string, string];
};
type Store = { step?: number; answers: Record<string, string>; completed: boolean; days: Record<string, Day> };

const KEY = "tico-shift:v1";
const EMPTY: Store = { answers: {}, completed: false, days: {} };
const emptyDay = (): Day => ({
  keyAction: "", keyStatus: "", energy: 0, focus: 0, morningDone: false, anchorDone: false,
  identityNote: "", lesson: "", gratitude: ["", "", ""],
});

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const defaultPhase = (): Phase => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "midday" : "evening"; };

function calcStreak(days: Record<string, Day>) {
  const d = new Date();
  const ok = (k: string) => !!days[k]?.keyStatus && !!days[k]?.morningDone;
  if (!ok(dateKey(d))) d.setDate(d.getDate() - 1); // היום עוד לא נסגר: לא שוברים רצף
  let n = 0;
  while (ok(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const card = "rounded-2xl bg-surface border border-line p-5";
const field = "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-brand";
const btn = "rounded-xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-40 dark:text-black";
const ghost = "rounded-xl border border-line px-5 py-3 font-medium";

export default function ShiftApp() {
  const [store, setStore] = useState<Store>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setStore({ ...EMPTY, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);

  const update = (fn: (s: Store) => Store) =>
    setStore((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });

  if (!ready) return null;
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      {store.completed ? <Main store={store} update={update} /> : <Onboarding store={store} update={update} />}
    </main>
  );
}

type P = { store: Store; update: (fn: (s: Store) => Store) => void };

/* ---------- שלב א': אבחון בפורמט שיחה ---------- */
function Onboarding({ store, update }: P) {
  return (
    <Chat
      answers={store.answers}
      step={Math.min(store.step ?? 0, ALL_QUESTIONS.length - 1)}
      onAnswer={(id, v, next) => update((s) => ({ ...s, answers: { ...s.answers, [id]: v }, step: Math.max(0, next) }))}
      onFinish={() => update((s) => ({ ...s, completed: true }))}
    />
  );
}

/* ---------- האפליקציה היומית ---------- */
function Main({ store, update }: P) {
  const [tab, setTab] = useState<"today" | "tools" | "profile">("today");
  const [tool, setTool] = useState<Tool>("sos");
  const name = store.answers.name || "";
  const streak = calcStreak(store.days);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">שלום{name ? `, ${name}` : ""}</p>
          <h1 className="text-2xl font-bold">הארכיטקט של החיים שלך</h1>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent">{streak}</div>
          <div className="text-xs text-muted">ימים ברצף</div>
        </div>
      </header>
      <nav className="grid grid-cols-3 rounded-xl border border-line bg-surface p-1 text-sm font-medium">
        {([["today", "היום"], ["tools", "כלים"], ["profile", "פרופיל"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2 ${tab === k ? "bg-brand text-white dark:text-black" : ""}`}>{l}</button>
        ))}
      </nav>
      {tab === "today" && <Today store={store} update={update} onSos={() => { setTool("sos"); setTab("tools"); }} />}
      {tab === "tools" && <Tools answers={store.answers} tool={tool} setTool={setTool} />}
      {tab === "profile" && <Profile store={store} update={update} />}
    </div>
  );
}

function Today({ store, update, onSos }: P & { onSos: () => void }) {
  const today = dateKey(new Date());
  const day = store.days[today] ?? emptyDay();
  const [phase, setPhase] = useState<Phase>(defaultPhase());
  const patch = (p: Partial<Day>) =>
    update((s) => ({ ...s, days: { ...s.days, [today]: { ...(s.days[today] ?? emptyDay()), ...p } } }));
  const a = store.answers;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-sm">
        {([["morning", "בוקר: Test"], ["midday", "צהריים: Operate"], ["evening", "ערב: Test + Exit"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPhase(k)} className={`rounded-xl border py-2 ${phase === k ? "border-brand bg-brand/10 font-semibold" : "border-line"}`}>{l}</button>
        ))}
      </div>

      <button onClick={onSos} className="w-full rounded-xl border border-accent bg-accent/10 py-2 text-sm font-semibold">מוצף או דוחה? כפתור חירום</button>
      {day.keyAction && (
        <div className="rounded-xl bg-accent/15 p-4 text-sm"><b>פעולת המפתח להיום:</b> {day.keyAction}</div>
      )}

      {phase === "morning" && (
        <div className="space-y-4">
          <div className={card}>
            <h2 className="font-bold">1. כיול תדר: ויזואליזציה של יעד הקצה</h2>
            <p className="mt-2 text-sm text-muted">עצום עיניים לדקה וחווה את המטרה כעובדה קיימת:</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              <li><b>רואה:</b> {a.see || "—"}</li>
              <li><b>שומע:</b> {a.hear || "—"}</li>
              <li><b>מרגיש:</b> {a.feel || "—"}</li>
              {a.smell && <li><b>ריח / טעם:</b> {a.smell}</li>}
            </ul>
            <Check checked={day.morningDone} onChange={(v) => patch({ morningDone: v })} label="עשיתי את הכיול" />
          </div>
          <div className={card}>
            <h2 className="font-bold">2. הפעלת עוגן</h2>
            <p className="mt-2 text-sm text-muted">העוגן שלך: {a.anchor || "לא הוגדר"}. הפעל אותו תוך כדי נשימה.</p>
            <Breath />
            <Check checked={day.anchorDone} onChange={(v) => patch({ anchorDone: v })} label="הפעלתי את העוגן" />
          </div>
          <div className={card}>
            <h2 className="font-bold">3. פעולת המפתח להיום</h2>
            <p className="mt-2 text-sm text-muted">משימה אחת בלבד שמזיזה את המחוג.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[a.habit1, a.habit2, a.habit3].filter(Boolean).map((h) => (
                <button key={h} className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => patch({ keyAction: h })}>{h}</button>
              ))}
            </div>
            <input className={`${field} mt-3`} value={day.keyAction} placeholder="או כתוב פעולה משלך" onChange={(e) => patch({ keyAction: e.target.value })} />
          </div>
        </div>
      )}

      {phase === "midday" && (
        <div className="space-y-4">
          <div className={card}>
            <h2 className="font-bold">בדיקת זהות</h2>
            <p className="mt-2 leading-relaxed">איך האדם שאתה הופך להיות{a.identity ? ` (“${a.identity}”)` : ""} מקבל את ההחלטה הזו עכשיו?</p>
            <textarea className={`${field} mt-3 min-h-24`} value={day.identityNote} placeholder="מה ההחלטה, ומה הייתה בוחרת הזהות החדשה?" onChange={(e) => patch({ identityNote: e.target.value })} />
          </div>
          <div className={card}>
            <h2 className="font-bold">מדד אנרגיה ופוקוס</h2>
            <Scale label="אנרגיה" value={day.energy} onChange={(v) => patch({ energy: v })} />
            <Scale label="פוקוס" value={day.focus} onChange={(v) => patch({ focus: v })} />
          </div>
        </div>
      )}

      {phase === "evening" && (
        <div className="space-y-4">
          <div className={card}>
            <h2 className="font-bold">1. האם בוצעה פעולת המפתח?</h2>
            <p className="mt-1 text-sm text-muted">{day.keyAction || "לא הוגדרה פעולה הבוקר."}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {([["done", "בוצע"], ["partial", "חלקית"], ["none", "לא בוצע"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => patch({ keyStatus: k })} className={`rounded-xl border py-3 ${day.keyStatus === k ? "border-brand bg-brand/10 font-semibold" : "border-line"}`}>{l}</button>
              ))}
            </div>
            {(day.keyStatus === "partial" || day.keyStatus === "none") && (
              <div className="mt-4">
                <p className="text-sm font-medium">משוב, לא כישלון: מה הניסוי הזה לימד אותי, ואיך אדייק מחר?</p>
                <textarea className={`${field} mt-2 min-h-24`} value={day.lesson} onChange={(e) => patch({ lesson: e.target.value })} />
              </div>
            )}
          </div>
          <div className={card}>
            <h2 className="font-bold">2. שלוש הכרות תודה קונקרטיות</h2>
            {[0, 1, 2].map((n) => (
              <input key={n} className={`${field} mt-3`} placeholder={`תודה ${n + 1}`} value={day.gratitude[n]}
                onChange={(e) => { const g = [...day.gratitude] as Day["gratitude"]; g[n] = e.target.value; patch({ gratitude: g }); }} />
            ))}
          </div>
          <div className={card}>
            <h2 className="font-bold">3. סגירת יום מנטלית</h2>
            <p className="mt-2 text-sm text-muted">שחרר שליטה. מה שלא נסגר היום ימשיך מחר. עכשיו זמן אישי ומשפחתי.</p>
            <Check checked={!!day.closed} onChange={(v) => patch({ closed: v })} label="סגרתי את היום" />
          </div>
          {day.keyStatus && <p className="text-center text-sm text-muted">היום נספר ברצף. עצם ההגעה לבקרת הערב היא חלק מהשינוי.</p>}
        </div>
      )}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="mt-4 flex items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm">{label}{value ? `: ${value}/10` : ""}</p>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} className={`rounded-lg border py-2 text-sm ${value === n ? "border-brand bg-brand text-white dark:text-black" : "border-line"}`}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function Breath() {
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setLeft(30);
    timer.current = setInterval(() => setLeft((l) => { if (l <= 1) { if (timer.current) clearInterval(timer.current); return 0; } return l - 1; }), 1000);
  };
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="size-16 rounded-full bg-accent/60" style={left ? { animation: "breathe 8s ease-in-out infinite" } : undefined} />
      <button className={ghost} onClick={start}>{left ? `נושם… ${left}` : "30 שניות של נשימה"}</button>
    </div>
  );
}

/* ---------- פרופיל ---------- */
function Profile({ store, update }: P) {
  const a = store.answers;
  const [editing, setEditing] = useState(false);
  const total = Object.keys(store.days).length;
  const done = useMemo(() => Object.values(store.days).filter((d) => d.keyStatus === "done").length, [store.days]);

  const streak = calcStreak(store.days);
  const avgEnergy = useMemo(() => {
    const cut = new Date(); cut.setDate(cut.getDate() - 6);
    const v = Object.entries(store.days).filter(([k, d]) => k >= dateKey(cut) && d.energy).map(([, d]) => d.energy);
    return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1) : "";
  }, [store.days]);

  if (editing) return <Editor store={store} update={update} onClose={() => setEditing(false)} />;

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-sm text-muted">המטרה</p><p className="font-semibold">{a.goal}</p>
        <p className="mt-4 text-sm text-muted">הזהות</p><p className="font-semibold">{a.identity}</p>
        {a.reframe && (<><p className="mt-4 text-sm text-muted">האמונה המעצימה</p><p className="font-semibold">{a.reframe}</p></>)}
      </div>
      <div className={card}>
        <p className="text-sm text-muted">הרגלי ליבה</p>
        <ul className="mt-1 list-disc ps-5">{[a.habit1, a.habit2, a.habit3].filter(Boolean).map((h) => <li key={h}>{h}</li>)}</ul>
        <p className="mt-4 text-sm text-muted">עוגן</p><p>{a.anchor || "—"}</p>
      </div>
      <div className={`${card} text-sm space-y-2`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-bold">{streak}</div>רצף</div>
          <div><div className="text-2xl font-bold">{total ? Math.round((done / total) * 100) : 0}%</div>ביצוע פעולת מפתח</div>
          <div><div className="text-2xl font-bold">{avgEnergy || "—"}</div>אנרגיה, 7 ימים</div>
        </div>
      </div>
      <div className="flex gap-3">
        <button className={`${ghost} flex-1`} onClick={() => setEditing(true)}>עריכת תשובות</button>
        <button className={ghost} onClick={() => {
          const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob); link.download = "tico-shift-backup.json"; link.click();
        }}>גיבוי</button>
        <button className={ghost} onClick={() => { if (confirm("למחוק את כל הנתונים במכשיר?")) update(() => EMPTY); }}>איפוס</button>
      </div>
    </div>
  );
}

function Editor({ store, update, onClose }: P & { onClose: () => void }) {
  return (
    <div className="space-y-4">
      {SECTIONS.map((s) => (
        <div key={s.id} className={card}>
          <h2 className="font-bold">{s.title}</h2>
          {s.questions.map((q) => (
            <label key={q.id} className="mt-4 block text-sm">
              <span className="mb-1 block text-muted">{q.label}</span>
              <textarea className={`${field} min-h-16`} value={store.answers[q.id] ?? ""}
                onChange={(e) => update((st) => ({ ...st, answers: { ...st.answers, [q.id]: e.target.value } }))} />
            </label>
          ))}
        </div>
      ))}
      <button className={`${btn} w-full`} onClick={onClose}>סיום עריכה</button>
    </div>
  );
}
