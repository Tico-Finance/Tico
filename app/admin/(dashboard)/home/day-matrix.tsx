"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  GOAL_LABELS,
  QUADRANTS,
  hhmm,
  type Block,
  type DayPlan,
  type Goal,
  type PriorityTask,
  type Quadrant,
} from "@/lib/priorities";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "./actions";

export interface DoneToday {
  messages: number;
  stages: number;
  content: number;
  tasks: number;
}

const QUAD_STYLE: Record<Quadrant, { ring: string; chip: string; dot: string }> = {
  1: { ring: "ring-rose-200", chip: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  2: { ring: "ring-emerald-200", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  3: { ring: "ring-amber-200", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-400" },
  4: { ring: "ring-slate-200", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};
const SHOWN: Record<Quadrant, number> = { 1: 8, 2: 6, 3: 4, 4: 3 };
const field = "rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-sm";

export default function DayMatrix({
  tasks, plan, planDate, isToday, today, nextWorkday, done, goals,
}: {
  tasks: PriorityTask[];
  plan: DayPlan;
  planDate: string;
  isToday: boolean;
  today: string;
  nextWorkday: string;
  done: DoneToday;
  goals: Record<Goal, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", due: "today", important: false, est: 15, goal: "admin" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setToast(r.error ?? "לא נשמר");
      else {
        if (ok) setToast(ok);
        router.refresh();
      }
    });

  const submit = () => {
    if (!form.title.trim()) return;
    const dueAt = form.due === "today" ? today : form.due === "next" ? nextWorkday : null;
    run(() => createTaskAction({ title: form.title.trim(), dueAt, important: form.important, estMinutes: form.est, goal: form.goal }), "המשימה נוספה");
    setForm({ title: "", due: "today", important: false, est: 15, goal: "admin" });
    setAdding(false);
  };

  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const totalMin = plan.blocks.reduce((s, b) => s + (b.end - b.start), 0);
  const day = new Date(`${planDate}T12:00:00Z`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const taskRow = (t: PriorityTask) => {
    const manual = t.source === "manual";
    return (
      <li key={t.key} className="flex items-start justify-between gap-2 py-2">
        {manual ? (
          <div className="min-w-0">
            <div className="font-medium">{t.title}</div>
            <div className={`text-xs ${t.late ? "text-rose-600" : "text-foreground/60"}`}>{t.sub} · {t.est} דק׳</div>
          </div>
        ) : (
          <Link href={t.href} className="min-w-0">
            <div className="font-medium">{t.title}</div>
            <div className={`truncate text-xs ${t.late ? "text-rose-600" : "text-foreground/60"}`}>{t.sub} · {t.est} דק׳</div>
          </Link>
        )}
        {manual ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <button disabled={pending} onClick={() => run(() => updateTaskAction(t.id, { status: "done" }), "סומן כבוצע")} className="rounded-lg bg-button px-2 py-1 text-xs font-medium text-white">בוצע</button>
            <button disabled={pending} onClick={() => run(() => updateTaskAction(t.id, { dueAt: nextWorkday, quadrantOverride: null }), "הועבר ליום הבא")} className="rounded-lg border border-black/10 px-2 py-1 text-xs text-primary">מחר</button>
            <select
              aria-label="העבר לפינה"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                if (v === "drop") run(() => deleteTaskAction(t.id), "נמחק");
                else run(() => updateTaskAction(t.id, { quadrantOverride: Number(v) }), "הועבר");
              }}
              className="rounded-lg border border-black/10 bg-transparent px-1 py-1 text-xs"
            >
              <option value="">העבר…</option>
              {([1, 2, 3, 4] as Quadrant[]).map((q) => <option key={q} value={q}>{`פינה ${q}: ${QUADRANTS[q].title}`}</option>)}
              <option value="drop">מחק</option>
            </select>
          </div>
        ) : (
          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-foreground/70">{GOAL_LABELS[t.goal]}</span>
        )}
      </li>
    );
  };

  const quadrant = (q: Quadrant) => {
    const list = tasks.filter((t) => t.quadrant === q);
    return (
      <div key={q} className={`rounded-2xl bg-surface p-3 shadow-sm ring-1 ${QUAD_STYLE[q].ring}`}>
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${QUAD_STYLE[q].dot}`} />
              {QUADRANTS[q].title}
              <span className={`rounded-full px-2 py-0.5 text-xs ${QUAD_STYLE[q].chip}`}>{list.length}</span>
            </div>
            <div className="text-xs text-foreground/60">{QUADRANTS[q].hint}</div>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="py-2 text-sm text-foreground/40">ריק</p>
        ) : (
          <ul className="divide-y divide-black/5">{list.slice(0, SHOWN[q]).map(taskRow)}</ul>
        )}
        {list.length > SHOWN[q] && <p className="pt-1 text-center text-xs text-foreground/50">{`ועוד ${list.length - SHOWN[q]}`}</p>}
      </div>
    );
  };

  const blockCard = (b: Block, i: number) => (
    <details key={i} className="rounded-xl bg-black/[0.03] px-3 py-2" open={i === 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${QUAD_STYLE[b.quadrant].dot}`} />
          <span className="font-medium">{b.title}</span>
          {b.overtime && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">חורג משעות העבודה</span>}
        </span>
        <span dir="ltr" className="shrink-0 text-xs text-foreground/60">{hhmm(b.start)}–{hhmm(b.end)}</span>
      </summary>
      <ul className="mt-1 divide-y divide-black/5">
        {b.keys.map((k) => byKey.get(k)).filter((t): t is PriorityTask => !!t).map(taskRow)}
      </ul>
    </details>
  );

  const goalTotal = Object.values(goals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-primary">{isToday ? "סדר היום" : `סדר היום ל${day}`}</h2>
            <p className="text-sm text-foreground/60">
              {plan.blocks.length ? `${plan.blocks.length} בלוקים · כ-${Math.round(totalMin / 6) / 10} שעות` : "אין מה לתכנן. יום פנוי."}
              {!isToday && " · היום כבר לא יום עבודה, אז זה מה שמחכה ליום העבודה הבא"}
            </p>
          </div>
          <button onClick={() => setAdding((v) => !v)} className="rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white">+ משימה</button>
        </div>

        {adding && (
          <div className="mt-3 grid gap-2 rounded-xl bg-black/[0.03] p-3">
            <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="מה צריך לעשות?" className={`${field} w-full`}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
            <div className="flex flex-wrap items-center gap-2">
              <select value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className={field} aria-label="מועד">
                <option value="today">היום</option><option value="next">יום העבודה הבא</option><option value="none">בלי תאריך</option>
              </select>
              <select value={form.est} onChange={(e) => setForm({ ...form, est: Number(e.target.value) })} className={field} aria-label="זמן משוער">
                {[5, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} דק׳</option>)}
              </select>
              <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className={field} aria-label="מה זה מקדם">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
              </select>
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} /> חשוב</label>
              <button disabled={pending || !form.title.trim()} onClick={submit} className="mr-auto rounded-lg bg-button px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">הוסף</button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">{plan.blocks.map(blockCard)}</div>
        {plan.overflow.length > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{`${plan.overflow.length} משימות לא נכנסו ליום ויעברו ליום הבא.`}</p>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">{([1, 2, 3, 4] as Quadrant[]).map(quadrant)}</div>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-semibold text-primary">איך היום מקדם את העסק</h2>
        {goalTotal === 0 ? (
          <p className="text-sm text-foreground/50">אין עדיין משימות חשובות ליום.</p>
        ) : (
          <ul className="space-y-2">
            {(Object.keys(GOAL_LABELS) as Goal[]).filter((g) => goals[g] > 0).map((g) => (
              <li key={g}>
                <div className="mb-1 flex justify-between text-sm"><span>{GOAL_LABELS[g]}</span><span className="text-foreground/60">{goals[g]} דק׳</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-button" style={{ width: `${Math.round((goals[g] / goalTotal) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-foreground/60">
          היום עשית: {done.messages} הודעות לשותפים · {done.stages} שלבים אצל לקוחות · {done.content} תוכן שפורסם · {done.tasks} משימות
        </p>
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center md:bottom-6">
          <span className="rounded-full bg-primary px-4 py-2 text-sm text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}
