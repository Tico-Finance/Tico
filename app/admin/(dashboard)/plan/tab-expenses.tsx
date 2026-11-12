"use client";

import { useState } from "react";
import type { Plan } from "@/lib/business-plan/model";
import type { ExpenseEntry } from "@/lib/business-plan/types";
import { MONTHS, money } from "@/lib/business-plan/format";
import { monthIndex, monthKey } from "@/lib/business-plan/dates";
import { Btn, Card, Num, OptNum, Pill } from "./ui";

export default function TabExpenses({
  plan1, expenses, today, ps, save, remove,
}: {
  plan1: Plan; expenses: Record<string, ExpenseEntry>; today: Date; ps: Date;
  save: (e: ExpenseEntry) => void; remove: (key: string) => void;
}) {
  const mc = monthIndex(today, ps);
  const rows = Array.from({ length: Math.round((plan1.weeks * 12) / 52) }, (_, m) => {
    const d = new Date(ps.getFullYear(), ps.getMonth() + m, 1);
    const k = monthKey(d);
    return { m, d, k, plan: plan1.costM[m] + plan1.marketing / Math.round((plan1.weeks * 12) / 52), a: expenses[k], br: (plan1.costBreak[m] ?? []).filter((x) => x[1] > 0) };
  });
  const cur = mc >= 0 && mc < 12 ? rows[mc] : null;
  const [draft, setDraft] = useState<{ key: string; amount: string; note: string } | null>(null);
  const curDraft = cur && draft && draft.key === cur.k ? draft : cur ? { key: cur.k, amount: cur.a ? String(cur.a.amount) : "", note: cur.a?.note ?? "" } : null;
  const [toast, setToast] = useState("");

  const sumPlan = rows.reduce((a, r) => a + r.plan, 0);
  const sumAct = rows.reduce((a, r) => a + (r.a ? r.a.amount : 0), 0);
  const sumPlanAct = rows.reduce((a, r) => a + (r.a ? r.plan : 0), 0);

  const diffPill = (d: number) => (d > 0 ? <Pill tone="bad">▲ <Num>{money(d)}</Num></Pill> : <Pill tone="good">✓ <Num>{money(Math.abs(d))}</Num></Pill>);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-extrabold text-primary">הוצאות לפי חודשים</h2>
        <p className="max-w-prose text-foreground/70">
          בסוף כל חודש, מזינים כמה יצא בפועל. החישובים של הבקרה והתחזית ישתמשו בהוצאות האמיתיות לחודשים שעברו, ובתכנון לחודשים הבאים.
          שכר, מתפעלים וחבילות שעות מוגדרים בהגדרות, בצעד &quot;היעד&quot;.
        </p>
      </div>
      <Card className="flex flex-col gap-3">
        {cur && curDraft ? (
          <>
            <b className="text-lg">החודש: {MONTHS[cur.d.getMonth()]} {cur.d.getFullYear()}</b>
            <p className="text-foreground/70">בתוכנית ההוצאות החודש הן <b><Num>{money(cur.plan)}</Num></b>. כמה יצא בפועל? (חשבונית של עוזרת, מתפעלים, הוצאות חריגות)</p>
            <span className="pl-field self-start" style={{ width: 200 }}>
              <input type="number" inputMode="decimal" min={0} step={100} value={curDraft.amount} placeholder={String(Math.round(cur.plan))} aria-label="הוצאות החודש בפועל"
                onChange={(e) => setDraft({ ...curDraft, amount: e.target.value })} />
            </span>
            <label className="flex flex-col gap-1 text-sm text-foreground/70">
              הערה (לא חובה)
              <input type="text" value={curDraft.note} maxLength={300} placeholder="למשל: חשבונית מתפעל, תוספת שעות"
                onChange={(e) => setDraft({ ...curDraft, note: e.target.value })} className="rounded-lg border border-black/10 bg-black/[.04] px-2.5 py-2 text-foreground" />
            </label>
            <div className="flex items-center gap-3">
              <Btn variant="pri" onClick={() => {
                if (curDraft.amount.trim() === "") { remove(cur.k); setToast("נמחק"); }
                else { save({ key: cur.k, amount: Math.max(+curDraft.amount || 0, 0), note: curDraft.note.trim() || undefined }); setToast("נשמר ✓"); }
                setTimeout(() => setToast(""), 2500);
              }}>שמור הוצאות החודש</Btn>
              {cur.a && <button type="button" className="pl-link" onClick={() => { remove(cur.k); setDraft(null); }}>נקה</button>}
              {toast && <span className="text-sm font-semibold" role="status">{toast}</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground/50">החודש הנוכחי מחוץ ל-12 חודשי התוכנית.</p>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="pl-table">
          <thead><tr><th>חודש</th><th>תכנון</th><th>בפועל</th><th>הפרש</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.a ? r.a.amount - r.plan : null;
              return (
                <tr key={r.k}>
                  <th scope="row">
                    {MONTHS[r.d.getMonth()]} {String(r.d.getFullYear()).slice(2)}
                    {r.m === mc && <span className="text-xs font-normal text-foreground/50"> (החודש)</span>}
                    <details className="text-xs font-normal text-foreground/55">
                      <summary className="cursor-pointer text-primary">פירוט</summary>
                      {r.br.map(([n, v]) => <div key={n} className="whitespace-nowrap">{n}: <Num>{money(v)}</Num></div>)}
                    </details>
                  </th>
                  <td className="v"><Num>{money(r.plan)}</Num></td>
                  <td>
                    <OptNum value={r.a ? r.a.amount : null} width={120} label={`הוצאות בפועל ${MONTHS[r.d.getMonth()]}`}
                      onCommit={(n) => (n == null ? remove(r.k) : save({ key: r.k, amount: n, note: r.a?.note }))} />
                  </td>
                  <td className="v">{diff == null ? <span className="text-foreground/50">—</span> : diffPill(diff)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><th scope="row">סה״כ</th><td><Num>{money(sumPlan)}</Num></td><td><Num>{money(sumAct)}</Num></td><td>{sumPlanAct ? diffPill(sumAct - sumPlanAct) : ""}</td></tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}
