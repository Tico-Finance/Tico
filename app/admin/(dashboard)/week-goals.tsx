import Link from "next/link";
import type { GoalRow } from "@/lib/business-plan/targets";

/** This week against the yearly plan: one bar per thing the plan asks for. */
export default function WeekGoals({ rows, year, title = "השבוע מול התוכנית" }: { rows: GoalRow[]; year: number; title?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-primary">{title}</h2>
        <Link href={`/admin/plan?year=${year}`} className="text-sm text-secondary">תוכנית {year}</Link>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const ratio = r.done / r.target;
          return (
            <li key={r.key}>
              <Link href={r.href} className="block">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="text-foreground/70">{r.done} מתוך {r.target}{r.done >= r.target ? " ✓" : ""}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${ratio >= 1 ? "bg-emerald-600" : ratio >= 0.5 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
