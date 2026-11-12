"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ActionEntry, DayEntry, ExpenseEntry, PlanData, PlanSettings } from "@/lib/business-plan/types";
import { defaultSettings } from "@/lib/business-plan/defaults";
import { buildParams, buildPlan } from "@/lib/business-plan/model";
import { buildDemo, type Hor, type Win } from "@/lib/business-plan/forecast";
import { dk, pdt } from "@/lib/business-plan/dates";
import { deletePlanEntriesAction, savePlanEntriesAction, savePlanSettingsAction } from "./actions";
import { planStartOfYear, yearSettings, type YearSummary } from "@/lib/business-plan/targets";
import { NeedsCard, YearBar } from "./year-bar";
import { cx } from "./ui";
import Wizard from "./wizard";
import TabPlan from "./tab-plan";
import TabWatch from "./tab-watch";
import TabReport from "./tab-report";
import TabMarketing from "./tab-marketing";
import TabExpenses from "./tab-expenses";

type Tab = "plan" | "watch" | "report" | "mkt" | "exp";
const TABS: { v: Tab; label: string }[] = [
  { v: "plan", label: "התוכנית" },
  { v: "watch", label: "בקרה" },
  { v: "report", label: "דיווח יומי" },
  { v: "mkt", label: "פעולות שיווק" },
  { v: "exp", label: "הוצאות" },
];

type Kind = "day" | "action" | "expense";
const noopSubscribe = () => () => {};
const SETTINGS_DEBOUNCE = 700;
const ENTRY_DEBOUNCE = 500;

export interface YearProps {
  year: number;
  closed: boolean;
  summary: YearSummary | null;
  years: { year: number; closed: boolean }[];
  canOpen: number[];
}

export default function PlanClient({ initial, ...year }: { initial: PlanData } & YearProps) {
  // "Today" only exists on the client (the server may be in another timezone), so render nothing until it is known.
  const todayKey = useSyncExternalStore(noopSubscribe, () => dk(new Date()), () => null);
  if (todayKey === null) return <div className="plan mx-auto max-w-4xl py-10 text-center text-foreground/50">טוען…</div>;
  return <PlanApp initial={initial} today={pdt(todayKey)} {...year} />;
}

function PlanApp({ initial, today, year, closed, summary, years, canOpen }: { initial: PlanData; today: Date } & YearProps) {
  const [saved, setSaved] = useState<PlanSettings | null>(initial.settings);
  const base = useMemo(() => yearSettings(saved ?? defaultSettings(planStartOfYear(year))), [saved, year]);
  const S = base;

  const [view, setView] = useState<"wizard" | "dash">(initial.settings?.done ? "dash" : "wizard");
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<Tab>("plan");
  const [K, setK] = useState(1);
  const [win, setWin] = useState<Win>("week");
  const [hor, setHor] = useState<Hor>("year");
  const [days, setDays] = useState(initial.days);
  const [actions, setActions] = useState(initial.actions);
  const [expenses, setExpenses] = useState(initial.expenses);
  const [flash, setFlash] = useState("");

  const say = useCallback((m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 3000);
  }, []);

  /* ---------- persistence (debounced, flushed when the page is hidden) ---------- */
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsLatest = useRef<PlanSettings | null>(null);
  const entryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const entryPending = useRef(new Map<string, { kind: Kind; data: unknown }>());

  const sendSettings = useCallback(async () => {
    const s = settingsLatest.current;
    settingsLatest.current = null;
    if (!s) return;
    const r = await savePlanSettingsAction(year, s);
    if (!r.ok) say("שמירת ההגדרות נכשלה: " + r.error);
  }, [say, year]);

  const sendEntry = useCallback(async (id: string) => {
    const p = entryPending.current.get(id);
    entryPending.current.delete(id);
    entryTimers.current.delete(id);
    if (!p) return;
    const r = await savePlanEntriesAction(p.kind, [p.data]);
    if (!r.ok) say("השמירה נכשלה: " + r.error);
  }, [say]);

  const flush = useCallback(() => {
    if (settingsTimer.current) { clearTimeout(settingsTimer.current); settingsTimer.current = null; void sendSettings(); }
    for (const [id, t] of [...entryTimers.current]) { clearTimeout(t); void sendEntry(id); }
  }, [sendSettings, sendEntry]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const commitSettings = useCallback((next: PlanSettings) => {
    setSaved(next);
    settingsLatest.current = next;
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(() => { settingsTimer.current = null; void sendSettings(); }, SETTINGS_DEBOUNCE);
  }, [sendSettings]);

  const upd = useCallback((fn: (d: PlanSettings) => void) => {
    if (closed) { say("השנה סגורה. כדי לערוך, פתח אותה מחדש."); return; }
    const d = structuredClone(base);
    fn(d);
    commitSettings(d);
  }, [base, commitSettings, closed, say]);

  const persist = useCallback((kind: Kind, key: string, data: unknown) => {
    const id = `${kind}:${key}`;
    entryPending.current.set(id, { kind, data });
    const old = entryTimers.current.get(id);
    if (old) clearTimeout(old);
    entryTimers.current.set(id, setTimeout(() => void sendEntry(id), ENTRY_DEBOUNCE));
  }, [sendEntry]);

  const unpersist = useCallback(async (kind: Kind, keys: string[]) => {
    for (const k of keys) {
      const id = `${kind}:${k}`;
      const t = entryTimers.current.get(id);
      if (t) clearTimeout(t);
      entryTimers.current.delete(id);
      entryPending.current.delete(id);
    }
    const r = await deletePlanEntriesAction(kind, keys);
    if (!r.ok) say("המחיקה נכשלה: " + r.error);
  }, [say]);

  /* ---------- entries ---------- */
  const saveDay = (e: DayEntry) => { setDays((m) => ({ ...m, [e.date]: e })); persist("day", e.date, e); };
  const removeDay = (k: string) => { setDays((m) => { const n = { ...m }; delete n[k]; return n; }); void unpersist("day", [k]); };
  const saveAction = (a: ActionEntry) => { setActions((m) => ({ ...m, [a.id]: a })); persist("action", a.id, a); };
  const patchAction = (id: string, patch: Partial<ActionEntry>) => {
    const cur = actions[id];
    if (!cur) return;
    saveAction({ ...cur, ...patch });
  };
  const removeAction = (id: string) => { setActions((m) => { const n = { ...m }; delete n[id]; return n; }); void unpersist("action", [id]); };
  const saveExpense = (e: ExpenseEntry) => { setExpenses((m) => ({ ...m, [e.key]: e })); persist("expense", e.key, e); };
  const removeExpense = (k: string) => { setExpenses((m) => { const n = { ...m }; delete n[k]; return n; }); void unpersist("expense", [k]); };

  /* ---------- derived plan ---------- */
  const ps = useMemo(() => planStartOfYear(year), [year]);
  const p = useMemo(() => buildParams(S, ps), [S, ps]);
  const plans = useMemo(() => [0.5, 1, 1.5].map((k) => buildPlan(p, k)), [p]);

  const hasDemo = Object.values(days).some((d) => d.demo) || Object.values(actions).some((a) => a.demo);
  const loadDemo = async () => {
    const demo = buildDemo(plans[1], today, ps);
    setDays((m) => ({ ...m, ...Object.fromEntries(demo.days.map((d) => [d.date, d])) }));
    setActions((m) => ({ ...m, ...Object.fromEntries(demo.actions.map((a) => [a.id, a])) }));
    if (demo.days.length) {
      const r = await savePlanEntriesAction("day", demo.days);
      if (!r.ok) say("השמירה נכשלה: " + r.error);
    }
    const r2 = await savePlanEntriesAction("action", demo.actions);
    if (!r2.ok) say("השמירה נכשלה: " + r2.error);
  };
  const removeDemo = () => {
    const dk_ = Object.values(days).filter((d) => d.demo).map((d) => d.date);
    const ak = Object.values(actions).filter((a) => a.demo).map((a) => a.id);
    setDays((m) => Object.fromEntries(Object.entries(m).filter(([, d]) => !d.demo)));
    setActions((m) => Object.fromEntries(Object.entries(m).filter(([, a]) => !a.demo)));
    if (dk_.length) void unpersist("day", dk_);
    if (ak.length) void unpersist("action", ak);
  };

  const finish = () => { upd((d) => { d.done = true; }); setView("dash"); setTab("plan"); window.scrollTo(0, 0); };
  const openStep = (n: number) => { setStep(n); setView("wizard"); window.scrollTo(0, 0); };
  const reset = () => {
    if (!window.confirm("לאפס את ההגדרות לדוגמה? הדיווחים וההוצאות שהזנת לא יימחקו.")) return;
    commitSettings(defaultSettings(planStartOfYear(year)));
    openStep(0);
  };

  return (
    <div className="plan mx-auto flex w-full max-w-4xl flex-col gap-6" dir="rtl">
      {view === "wizard" ? (
        <Wizard S={S} upd={upd} step={step} go={(n) => { setStep(n); window.scrollTo(0, 0); }} finish={finish} planYear={ps.getFullYear()} />
      ) : (
        <>
          <header className="flex flex-col gap-3">
            <h1 className="text-2xl font-extrabold text-primary">תוכנית עסקית {year}</h1>
            <YearBar year={year} closed={closed} summary={summary} years={years} canOpen={canOpen} />
            <nav className="flex gap-1.5 overflow-x-auto border-b-2" style={{ borderColor: "var(--pl-line)" }} role="tablist" aria-label="אזורים">
              {TABS.map((t) => (
                <button key={t.v} type="button" role="tab" aria-selected={tab === t.v} onClick={() => setTab(t.v)}
                  className={cx("-mb-0.5 whitespace-nowrap border-b-[3px] px-4 py-2.5 text-base font-bold", tab === t.v ? "text-foreground" : "text-foreground/60")}
                  style={{ borderColor: tab === t.v ? "var(--pl-gold)" : "transparent" }}>
                  {t.label}
                </button>
              ))}
            </nav>
          </header>

          {tab === "plan" && (
            <>
              <NeedsCard S={S} year={year} />
              <TabPlan S={S} p={p} plans={plans} K={K} setK={setK} setTarget={(n) => upd((d) => { d.target = n; })} openStep={openStep} />
              {!closed && <p><button type="button" className="pl-link text-sm" onClick={reset}>איפוס לדוגמה והתחלה מחדש</button></p>}
            </>
          )}
          {tab === "watch" && (
            <TabWatch p={p} plans={plans} days={days} expenses={expenses} today={today} ps={ps} win={win} setWin={setWin} hor={hor} setHor={setHor}
              hasDemo={hasDemo} loadDemo={loadDemo} removeDemo={removeDemo} goReport={() => setTab("report")} />
          )}
          {tab === "report" && <TabReport days={days} plan1={plans[1]} today={today} ps={ps} save={saveDay} remove={removeDay} />}
          {tab === "mkt" && (
            <TabMarketing actions={actions} chans={S.chans} today={today} save={saveAction} patch={patchAction} remove={removeAction}
              addToPlan={(g) => { upd((d) => { d.chans.push({ n: g.name, unit: g.unit, on: true, share: 10, y: g.y, cost: g.cost, h: g.h, custom: true }); }); say("נוסף לתוכנית. אפשר לשנות את החלק שלו בהגדרות הלידים."); }}
              updatePlan={(g) => { upd((d) => { const c = d.chans.find((x) => x.n.trim() === g.name); if (c) { c.y = g.y; c.cost = g.cost; c.h = g.h; } }); say(`התפוקה בתוכנית עודכנה: ${g.y} לידים ליחידה`); }} />
          )}
          {tab === "exp" && <TabExpenses plan1={plans[1]} expenses={expenses} today={today} ps={ps} save={saveExpense} remove={removeExpense} />}
        </>
      )}

      {flash && (
        <div role="status" className="fixed inset-x-4 bottom-5 z-20 mx-auto max-w-md rounded-xl bg-foreground px-5 py-3 text-center font-semibold text-background shadow-lg">
          {flash}
        </div>
      )}
    </div>
  );
}
