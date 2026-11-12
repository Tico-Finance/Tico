"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GOAL_LABELS, hhmm, type Goal } from "@/lib/priorities";
import { STARTER_ROUTINES, WEEKDAY_LABELS, weekGrid, type RoutineLog, type RoutineRow } from "@/lib/routines";
import { createRoutineAction, deleteRoutineAction, logRoutineDayAction, updateRoutineAction } from "./actions";

const card = "rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5";
const field = "rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-sm";
const MARK = { done: "✓", skipped: "–", missed: "✗", pending: "·" } as const;
const MARK_STYLE = { done: "bg-emerald-100 text-emerald-800", skipped: "bg-slate-100 text-slate-500", missed: "bg-rose-100 text-rose-700", pending: "bg-amber-50 text-amber-700" } as const;

const toTime = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };

export default function RoutinesApp({ routines, logs, weekStart, today }: { routines: RoutineRow[]; logs: RoutineLog[]; weekStart: string; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? "הפעולה נכשלה"); else { setErr(""); setEditing(null); router.refresh(); } });

  const grid = weekGrid(routines, logs, weekStart, today);
  const dayNum = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">הרגלים קבועים</h1>
          <p className="text-sm text-foreground/60">מה שחייב לקרות כל שבוע. כל אחד מופיע ביום שלו בתכנון היום, ונשאר עד שמסמנים בוצע או דילוג.</p>
        </div>
        <Link href="/admin/home" className="text-sm text-secondary">חזרה ליום</Link>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}

      {routines.length === 0 && (
        <section className={card}>
          <p className="mb-3 text-sm">עוד אין הרגלים. אפשר להתחיל מהמקובלים אצלך ולערוך אחר כך את הימים והשעות.</p>
          <button disabled={pending} onClick={() => run(async () => { for (const r of STARTER_ROUTINES) await createRoutineAction(r); return { ok: true }; })}
            className="rounded-xl bg-button px-4 py-2 text-sm font-medium text-white">להוסיף: הקלטה, שליחה לעריכה, אישור ופרסום</button>
        </section>
      )}

      {grid.length > 0 && (
        <section className={card}>
          <h2 className="mb-2 font-semibold text-primary">השבוע</h2>
          <div className="grid grid-cols-[1fr_repeat(7,2rem)] items-center gap-x-1 gap-y-2 text-center text-xs">
            <span />
            {WEEKDAY_LABELS.map((d, i) => <span key={d} className="text-foreground/60" title={dayNum(grid[0].cells[i].date)}>{d.slice(0, 1)}׳</span>)}
            {grid.map(({ routine, cells }) => (
              <div key={routine.id} className="contents">
                <span className="truncate text-start text-sm">{routine.title}</span>
                {cells.map((c) => c.due && c.status ? (
                  <button key={c.date} disabled={pending} title={`${dayNum(c.date)} · לחיצה מחליפה בין בוצע, דילוג וריק`}
                    onClick={() => run(() => logRoutineDayAction(routine.id, c.date, c.status === "done" ? "skipped" : c.status === "skipped" ? null : "done"))}
                    className={`mx-auto h-7 w-7 rounded-md text-sm font-bold ${MARK_STYLE[c.status]}`}>{MARK[c.status]}</button>
                ) : <span key={c.date} />)}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-foreground/50">✓ בוצע · ✗ לא בוצע · – דולג · · עוד לפניך</p>
        </section>
      )}

      <section className={card}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-primary">ההרגלים</h2>
          <button onClick={() => setEditing("new")} className="text-sm text-secondary">+ הרגל חדש</button>
        </div>
        {editing === "new" && <RoutineForm pending={pending} onCancel={() => setEditing(null)} onSave={(v) => run(() => createRoutineAction(v))} />}
        <ul className="divide-y divide-black/5">
          {routines.map((r) => editing === r.id ? (
            <li key={r.id} className="py-2"><RoutineForm initial={r} pending={pending} onCancel={() => setEditing(null)} onSave={(v) => run(() => updateRoutineAction(r.id, v))}
              onDelete={() => { if (window.confirm("למחוק את ההרגל?")) run(() => deleteRoutineAction(r.id)); }} /></li>
          ) : (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <div className={`min-w-0 ${r.active ? "" : "opacity-50"}`}>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-foreground/60">
                  {r.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}{r.startMin !== null ? ` · ${hhmm(r.startMin)}` : ""} · {r.estMinutes} דק׳ · {GOAL_LABELS[r.goal as Goal] ?? r.goal}{r.flexible ? " · גמיש" : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                <button onClick={() => run(() => updateRoutineAction(r.id, { active: !r.active }))} className="text-foreground/60">{r.active ? "השהה" : "הפעל"}</button>
                <button onClick={() => setEditing(r.id)} className="text-secondary">עריכה</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoutineForm({ initial, pending, onSave, onCancel, onDelete }: {
  initial?: RoutineRow; pending: boolean; onSave: (v: unknown) => void; onCancel: () => void; onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? []);
  const [time, setTime] = useState(initial?.startMin != null ? hhmm(initial.startMin) : "");
  const [est, setEst] = useState(initial?.estMinutes ?? 60);
  const [goal, setGoal] = useState(initial?.goal ?? "exposure");
  const [flexible, setFlexible] = useState(initial?.flexible ?? false);
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  return (
    <div className="mb-2 space-y-2 rounded-xl bg-primary/5 p-3">
      <input className={`${field} w-full`} placeholder="מה צריך לקרות (למשל: הקלטת פודקאסט)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <button key={d} type="button" onClick={() => toggle(i)} className={`rounded-full px-3 py-1 text-sm ring-1 ring-black/10 ${days.includes(i) ? "bg-primary text-white" : "bg-surface"}`}>{d}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1">שעה קבועה (אופציונלי) <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="flex items-center gap-1">משך <input type="number" min={5} max={600} step={5} className={`${field} w-20`} value={est} onChange={(e) => setEst(Number(e.target.value))} /> דק׳</label>
        <select className={field} value={goal} onChange={(e) => setGoal(e.target.value)}>
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /> גמיש: חשוב אבל לא דחוף ביום שלו</label>
      <div className="flex gap-2">
        <button disabled={pending || !title.trim() || days.length === 0} onClick={() => onSave({ title, weekdays: days, startMin: time ? toTime(time) : null, estMinutes: est, goal, flexible })}
          className="rounded-xl bg-button px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">שמירה</button>
        <button onClick={onCancel} className="rounded-xl px-3 py-1.5 text-sm text-foreground/60">ביטול</button>
        {onDelete && <button onClick={onDelete} className="mr-auto text-sm text-rose-600">מחיקה</button>}
      </div>
    </div>
  );
}
