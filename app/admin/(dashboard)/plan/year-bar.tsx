"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanSettings } from "@/lib/business-plan/types";
import { yearNeeds, type YearSummary } from "@/lib/business-plan/targets";
import { MONTHS, money, nf } from "@/lib/business-plan/format";
import { closePlanYearAction, createPlanYearAction, reopenPlanYearAction } from "./actions";
import { cx } from "./ui";

interface Props {
  year: number;
  closed: boolean;
  summary: YearSummary | null;
  years: { year: number; closed: boolean }[];
  canOpen: number[];
}

/** Switch between yearly plans, close the current one, open the next. */
export function YearBar({ year, closed, summary, years, canOpen }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, goto?: number) => {
    setBusy(true); setErr("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "הפעולה נכשלה"); return; }
    router.push(`/admin/plan?year=${goto ?? year}`);
    router.refresh();
  };
  const close = () => {
    if (!window.confirm(`לסגור את תוכנית ${year}? ההגדרות יישמרו כמו שהן, יחד עם סיכום של התוכנית מול מה שקרה בפועל. אפשר לפתוח מחדש בכל רגע.`)) return;
    void run(() => closePlanYearAction(year));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <Link key={y.year} href={`/admin/plan?year=${y.year}`}
            className={cx("rounded-full px-3 py-1 text-sm font-bold ring-1 ring-black/10", y.year === year ? "bg-primary text-white" : "bg-surface text-primary")}>
            {y.year}{y.closed ? " · סגורה" : ""}
          </Link>
        ))}
        {canOpen.map((y) => (
          <button key={y} type="button" disabled={busy} onClick={() => void run(() => createPlanYearAction(y), y)}
            className="rounded-full border border-dashed border-primary/40 px-3 py-1 text-sm font-bold text-primary disabled:opacity-50">
            + תוכנית {y}
          </button>
        ))}
        <span className="flex-1" />
        {!closed && <button type="button" disabled={busy} onClick={close} className="text-sm font-bold text-secondary disabled:opacity-50">סגירת {year}</button>}
        {closed && <button type="button" disabled={busy} onClick={() => void run(() => reopenPlanYearAction(year))} className="text-sm font-bold text-secondary disabled:opacity-50">פתיחה מחדש לעריכה</button>}
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {closed && summary && <ClosedSummary s={summary} />}
    </div>
  );
}

function ClosedSummary({ s }: { s: YearSummary }) {
  const pct = s.target > 0 ? Math.round((s.income / s.target) * 100) : 0;
  const rows: [string, { plan: number; actual: number }][] = [["לידים", s.leads], ["פגישות", s.meetings], ["תיקים חתומים", s.signed]];
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-primary">סיכום {s.year} · נשמר ולא ישתנה</h2>
      <p className="mt-1 text-sm">הכנסה בפועל {money(s.income)} מתוך יעד {money(s.target)} ({pct}%).</p>
      <ul className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
        {rows.map(([l, v]) => (
          <li key={l} className="rounded-xl bg-primary/5 p-2">
            <div className="text-lg font-bold text-primary">{nf(v.actual)}</div>
            <div className="text-xs text-foreground/60">{l} · תוכנית {nf(v.plan)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What the year's income target asks of him, in numbers per year and per week. */
export function NeedsCard({ S, year }: { S: PlanSettings; year: number }) {
  const n = yearNeeds(S, year);
  const items: [string, string][] = [
    ["תיקים חתומים", nf(n.cases)],
    ["פגישות לקוחות", nf(n.meetings)],
    ["לידים", nf(n.leads)],
    ["תכנים שמתפרסמים", `${nf(n.content / n.weeks)} בשבוע`],
    ["פניות לשותפים", `${nf(n.outreach / n.weeks)} בשבוע`],
    ["שעות עבודה", `${nf(n.hoursPerWeek)} בשבוע`],
  ];
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-primary">כדי להרוויח {money(n.target)} {n.from === 0 && n.to === 11 ? `ב-${year}` : `מ${MONTHS[n.from]} עד ${MONTHS[n.to]} ${year}`} צריך</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        {items.map(([l, v]) => (
          <li key={l} className="rounded-xl bg-primary/5 p-2">
            <div className="text-lg font-bold text-primary">{v}</div>
            <div className="text-xs text-foreground/60">{l}</div>
          </li>
        ))}
      </ul>
      {n.to - n.from < 3 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">תקופה קצרה: כסף מלידים חדשים מגיע אחרי כמה חודשים, ולכן רוב ההכנסה כאן תלויה בתיקים שכבר פתוחים אצלך. כדאי לעדכן את מספר התיקים הפתוחים בהגדרות.</p>}
      <p className="mt-2 text-xs text-foreground/60">המספרים האלה הם מה שמסך היום והשבוע שלי מודד אותך מולו.</p>
    </section>
  );
}
