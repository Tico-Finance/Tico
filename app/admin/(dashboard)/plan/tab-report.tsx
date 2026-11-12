"use client";

import { useState } from "react";
import type { Plan } from "@/lib/business-plan/model";
import type { DayEntry } from "@/lib/business-plan/types";
import { dec, money } from "@/lib/business-plan/format";
import { actSum, METRICS, planSum, type Days } from "@/lib/business-plan/forecast";
import { addD, dk, pdt } from "@/lib/business-plan/dates";
import { Btn, Card, Num, NumInput } from "./ui";

type Fields = Pick<DayEntry, "leads" | "meetings" | "submissions" | "signed" | "cash">;
const hdate = (k: string) => pdt(k).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
const EMPTY: Fields = { leads: 0, meetings: 0, submissions: 0, signed: 0, cash: 0 };

const COUNTERS: { f: keyof Fields; label: string }[] = [
  { f: "leads", label: "לידים חדשים" },
  { f: "meetings", label: "פגישות שקיימתי" },
  { f: "signed", label: "הסכמי התקשרות שנחתמו" },
  { f: "submissions", label: "תיקים שהוגשו לבנקים" },
];

export default function TabReport({
  days, plan1, today, ps, save, remove,
}: {
  days: Days; plan1: Plan; today: Date; ps: Date;
  save: (e: DayEntry) => void; remove: (date: string) => void;
}) {
  const todayKey = dk(today);
  const [date, setDate] = useState(todayKey);
  const wa = addD(today, -today.getDay());
  const keys = Object.keys(days).sort().reverse().slice(0, 14);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-extrabold text-primary">דיווח יומי</h2>
        <p className="text-foreground/70">חצי דקה בסוף היום: מה קרה היום במספרים. זה מה שמזין את הבקרה.</p>
      </div>
      <ReportForm key={date} date={date} todayKey={todayKey} existing={days[date]} setDate={setDate} save={save} />

      <section className="flex flex-col gap-2">
        <h3 className="font-bold">השבוע עד עכשיו</h3>
        <Card>
          <div className="flex flex-col gap-1.5">
            {METRICS.map((m) => {
              const pl = planSum(plan1, m.key, wa, today, ps), ac = actSum(days, m.field, wa, today), r = pl > 0 ? ac / pl : 0;
              const f = (v: number) => (m.key === "income" ? money(v) : dec(v));
              return (
                <div key={m.key} className="grid grid-cols-[minmax(110px,150px)_1fr_auto] items-center gap-3 py-1 max-sm:grid-cols-[1fr_auto]">
                  <span>{m.label}</span>
                  <div className="h-2.5 overflow-hidden rounded-full max-sm:order-3 max-sm:col-span-2" style={{ background: "var(--pl-soft)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${Math.min(r, 1) * 100}%`, background: "var(--pl-money)" }} />
                  </div>
                  <b className="num text-sm">{f(ac)} / {f(pl)}</b>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-bold">דיווחים אחרונים</h3>
        <Card>
          {keys.length === 0 ? <p className="text-sm text-foreground/50">עוד אין דיווחים.</p> : (
            <div className="overflow-x-auto">
              <table className="pl-table">
                <thead><tr><th>יום</th><th>לידים</th><th>פגישות</th><th>חתימות על הסכם</th><th>הגשות</th><th>כסף</th><th /></tr></thead>
                <tbody>
                  {keys.map((k) => {
                    const d = days[k];
                    return (
                      <tr key={k}>
                        <th scope="row">{hdate(k)}{d.demo && <> <span className="text-xs font-normal text-foreground/50">(דוגמה)</span></>}</th>
                        <td className="v">{d.leads}</td><td className="v">{d.meetings}</td><td className="v">{d.signed}</td><td className="v">{d.submissions}</td>
                        <td className="v"><Num>{money(d.cash)}</Num></td>
                        <td className="whitespace-nowrap">
                          <button type="button" className="pl-link" onClick={() => { setDate(k); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ערוך</button>
                          {" · "}
                          <button type="button" className="pl-link" onClick={() => remove(k)}>מחק</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function ReportForm({
  date, todayKey, existing, setDate, save,
}: { date: string; todayKey: string; existing: DayEntry | undefined; setDate: (d: string) => void; save: (e: DayEntry) => void }) {
  const [vals, setVals] = useState<Fields>(
    existing ? { leads: existing.leads, meetings: existing.meetings, submissions: existing.submissions, signed: existing.signed, cash: existing.cash } : EMPTY
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [toast, setToast] = useState("");
  const set = (f: keyof Fields, n: number) => setVals((v) => ({ ...v, [f]: Math.max(n, 0) }));

  return (
    <Card className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="rd-date" className="font-bold">איזה יום מדווחים?</label>
      <input id="rd-date" type="date" value={date} max={todayKey} onChange={(e) => e.target.value && setDate(e.target.value)}
        className="rounded-lg border border-black/10 bg-black/[.04] px-2.5 py-2 font-semibold" />
      <b>{hdate(date)}{date === todayKey ? " · היום" : ""}</b>
    </div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
      {COUNTERS.map((c) => (
        <div key={c.f} className="flex flex-col gap-1.5">
          <span className="font-semibold">{c.label}</span>
          <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-black/10">
            <button type="button" className="w-12 bg-black/[.05] text-2xl font-bold" aria-label="פחות" onClick={() => set(c.f, vals[c.f] - 1)}>−</button>
            <input type="number" min={0} inputMode="numeric" value={vals[c.f]} onChange={(e) => set(c.f, +e.target.value || 0)}
              className="num min-w-0 flex-1 bg-transparent py-2 text-center text-2xl font-extrabold" aria-label={c.label} />
            <button type="button" className="w-12 bg-black/[.05] text-2xl font-bold" aria-label="יותר" onClick={() => set(c.f, vals[c.f] + 1)}>+</button>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">כסף שנכנס היום (₪)</span>
        <NumInput value={vals.cash} step={500} onChange={(n) => set("cash", n)} label="כסף שנכנס" />
      </div>
    </div>
    <label className="flex flex-col gap-1 text-sm text-foreground/70">
      הערה (לא חובה)
      <input type="text" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="למשל: שבוע חג, פגישה גדולה"
        className="rounded-lg border border-black/10 bg-black/[.04] px-2.5 py-2 text-foreground" />
    </label>
    <div className="flex items-center gap-3">
      <Btn variant="pri" onClick={() => { save({ date, ...vals, notes: notes.trim() || undefined }); setToast("נשמר ✓ " + hdate(date)); setTimeout(() => setToast(""), 2500); }}>
        {existing ? "עדכן את הדיווח" : "שמור דיווח"}
      </Btn>
      {toast && <span className="text-sm font-semibold text-[color:var(--pl-good)]" role="status">{toast}</span>}
    </div>
  </Card>
  );
}
