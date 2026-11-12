"use client";

import type { Params, Plan } from "@/lib/business-plan/model";
import { MONTHS, dec, kfmt, money, nf } from "@/lib/business-plan/format";
import { atCum, buildForecast, buildVerdict, cumSigned, statusOf, watchRows, type Days, type Expenses, type Hor, type Win } from "@/lib/business-plan/forecast";
import { BarChart, LineChart } from "./charts";
import { Btn, Card, Legend, Num, Pill, Seg } from "./ui";

function Status({ r }: { r: number }) {
  const s = statusOf(r);
  return s === "good" ? <Pill tone="good">✓ בקצב</Pill> : s === "warn" ? <Pill tone="warn">▲ מתחת</Pill> : <Pill tone="bad">✕ רחוק</Pill>;
}

const fmtMetric = (key: string, v: number) => (key === "income" ? money(v) : dec(v));
const hd = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

export default function TabWatch({
  p, plans, days, expenses, today, ps, win, setWin, hor, setHor, hasDemo, loadDemo, removeDemo, goReport,
}: {
  p: Params; plans: Plan[]; days: Days; expenses: Expenses; today: Date; ps: Date;
  win: Win; setWin: (w: Win) => void; hor: Hor; setHor: (h: Hor) => void;
  hasDemo: boolean; loadDemo: () => void; removeDemo: () => void; goReport: () => void;
}) {
  const P1 = plans[1];
  const has = Object.keys(days).length > 0;
  const { rows, label } = watchRows(P1, days, win, today, ps);
  const fc = has ? buildForecast(P1, days, expenses, hor, today, ps) : null;
  const vd = has ? buildVerdict(plans, days, today, ps) : null;
  const xs = Array.from({ length: 53 }, (_, i) => i);
  const c50 = cumSigned(plans[0]), c100 = cumSigned(plans[1]), c150 = cumSigned(plans[2]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-primary">איפה אני עכשיו</h2>
        <div>
          <Seg value={win} onChange={setWin} label="טווח זמן" options={[{ v: "day", label: "היום" }, { v: "week", label: "השבוע" }, { v: "month", label: "החודש" }, { v: "all", label: "מתחילת התוכנית" }]} />
        </div>
        <Card>
          {!has ? (
            <div className="flex flex-col gap-2.5">
              <b className="text-lg">עוד לא דיווחת כלום</b>
              <p className="text-foreground/70">כשתדווח מה קרה כל יום, כאן תראה אם אתה בקצב של התוכנית. זה לוקח חצי דקה.</p>
              <div className="flex flex-wrap gap-3">
                <Btn variant="pri" onClick={goReport}>דווח את היום</Btn>
                <Btn onClick={loadDemo}>טען נתוני דוגמה</Btn>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-1.5 text-xs text-foreground/55">{label} · מול התכנון של התרחיש &quot;היעד&quot;</p>
              <div className="overflow-x-auto">
                <table className="pl-table">
                  <thead><tr><th /><th>תכנון</th><th>בפועל</th><th className="min-w-[90px]" /><th>סטטוס</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <th scope="row">{r.label}</th>
                        <td className="v"><Num>{fmtMetric(r.key, r.plan)}</Num></td>
                        <td className="v"><Num>{fmtMetric(r.key, r.act)}</Num></td>
                        <td><span className="block h-2 min-w-[2px] rounded-sm" style={{ width: `${(Math.min(r.ratio, 1.5) / 1.5) * 100}%`, background: "var(--pl-money)" }} /></td>
                        <td>{r.plan < 0.3 && win === "day" ? <span className="text-foreground/50">—</span> : <Status r={r.ratio} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
        {hasDemo && (
          <p className="text-sm text-foreground/60">יש כאן נתוני דוגמה. <button type="button" className="pl-link" onClick={removeDemo}>מחק נתוני דוגמה</button></p>
        )}
      </section>

      {has && fc && vd && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold text-primary">תחזית לפי מה שדיווחתי</h2>
            <div>
              <Seg value={hor} onChange={setHor} label="עד מתי" options={[{ v: "month", label: "סוף החודש" }, { v: "quarter", label: "סוף הרבעון" }, { v: "year", label: "סוף השנה" }, { v: "plan", label: "12 החודשים" }]} />
            </div>
            <Card>
              <p className="text-base leading-relaxed">
                עד <b>{hd(fc.hE)}</b>, אם תמשיך בקצב שדיווחת, תסגור בערך <b><Num>{dec(fc.rows[3].cur)}</Num> תיקים</b> ויכנסו לך <b><Num>{money(fc.rows[4].cur)}</Num></b>.
                אחרי הוצאות: {fc.net.cur >= 0 ? "נשאר בכיס" : "חסרים"} <b><Num>{money(Math.abs(fc.net.cur))}</Num></b> {fc.net.cur >= 0 ? <Pill tone="good">✓ רווח</Pill> : <Pill tone="bad">✕ גירעון</Pill>}.
              </p>
              {fc.young && <p className="mt-1.5 text-sm text-foreground/55">עדיין מעט נתונים בתוכנית עד היום, ולכן ההערכה גסה ותתייצב ככל שיעברו עוד שבועות ותדווח עוד ימים.</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="pl-table">
                  <thead><tr><th>עד {hd(fc.hE)}</th><th>דיווחתי עד היום</th><th>בקצב הנוכחי</th><th>אם אחזור לתכנון</th><th>התכנון</th></tr></thead>
                  <tbody>
                    {fc.rows.map((r) => (
                      <tr key={r.key}>
                        <th scope="row">{r.label}</th>
                        {[r.act, r.cur, r.back, r.plan].map((v, i) => <td key={i} className="v"><Num>{fmtMetric(r.key, v)}</Num></td>)}
                      </tr>
                    ))}
                    <tr className="sep">
                      <th scope="row">אחרי הוצאות</th>
                      <td className="v">—</td>
                      {[fc.net.cur, fc.net.back, fc.net.plan].map((v, i) => (
                        <td key={i} className="v"><Num>{money(v)}</Num> {v >= 0 ? <Pill tone="good">✓</Pill> : <Pill tone="bad">✕</Pill>}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-foreground/55">
                &quot;בקצב הנוכחי&quot;: מה שדיווחת עד היום, ובהמשך אותו אחוז מהתכנון שאתה עומד בו עד עכשיו (כסף <Num>{Math.round(fc.pace.income * 100)}%</Num>, תיקים <Num>{Math.round(fc.pace.signed * 100)}%</Num>, לידים <Num>{Math.round(fc.pace.leads * 100)}%</Num>).
                &quot;אם אחזור לתכנון&quot;: מה שדיווחת, ובהמשך בדיוק לפי התוכנית. ההוצאות: בפועל לחודשים שהזנת, ולפי ההגדרות לשאר.
              </p>
            </Card>
            <Card>
              <h3 className="mb-1.5 font-bold">כסף שנכנס בכל חודש</h3>
              <Legend items={[{ t: "בפועל", color: "var(--pl-money)" }, { t: "תחזית בקצב הנוכחי", color: "var(--pl-gold)" }, { t: "התכנון", color: "currentColor", kind: "dash" }]} />
              <BarChart aria="כסף שנכנס בכל חודש: בפועל, תחזית ותכנון" labels={fc.chart.labels} yFmt={kfmt} tipFmt={(v) => "₪" + nf(v)} tipTitle={(i) => fc.chart.labels[i]}
                series={[{ name: "בפועל", color: "var(--pl-money)", v: fc.chart.actual }, { name: "תחזית בקצב הנוכחי", color: "var(--pl-gold)", v: fc.chart.projected }]}
                line={{ name: "התכנון", v: fc.chart.plan }} />
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold text-primary">לאן זה מוביל, בתיקים</h2>
            <Card className="flex flex-col gap-1.5 border-s-4" >
              <p className="text-xs text-foreground/55">בקצב הנוכחי (<Num>{Math.round(vd.pace * 100)}%</Num> מהתכנון, לפי {vd.basis === "signed" ? "לקוחות חדשים" : "לידים"})</p>
              <p className="text-2xl font-extrabold"><Num>{dec(vd.final)} תיקים</Num> <span className="text-base font-semibold text-foreground/70">בסוף השנה</span></p>
              <p>
                זה <Num>{Math.round(vd.ratio * 100)}%</Num> מהיעד, {vd.near}.{" "}
                {vd.ratio < 1 ? <>כדי לחזור ליעד צריך לסגור בערך <b><Num>{dec(vd.needPerMonth)}</Num></b> תיקים בחודש בשאר השנה.</> : "אפשר להמשיך בקצב הזה."}
              </p>
            </Card>
            <Card>
              <Legend items={[{ t: "בפועל", color: "currentColor", kind: "line" }, { t: "המשך בקצב הנוכחי", color: "currentColor", kind: "dash" }, { t: "היעד", color: "var(--pl-s100)", kind: "line" }, { t: "חצי ופי 1.5", color: "var(--pl-s50)", kind: "dash" }]} />
              <LineChart aria="תיקים מצטברים: תכנון מול בפועל" count={53} yFmt={(v) => dec(v)} tipFmt={(v) => dec(v) + " תיקים"} cur={vd.weekNow}
                ticks={Array.from({ length: 12 }, (_, m) => ({ i: Math.round((m * 52) / 12), label: MONTHS[(p.start + m) % 12] }))} tipTitle={(i) => `שבוע ${i}`}
                series={[
                  { name: "פי 1.5", color: "var(--pl-s150)", v: xs.map((i) => atCum(c150, i)), w: 1.5, label: "פי 1.5" },
                  { name: "היעד", color: "var(--pl-s100)", v: xs.map((i) => atCum(c100, i)), w: 2.5, label: "היעד" },
                  { name: "חצי מהיעד", color: "var(--pl-s50)", v: xs.map((i) => atCum(c50, i)), w: 1.5, dash: "6 4", label: "חצי" },
                  { name: "בפועל", color: "currentColor", v: vd.actualSeries, w: 3 },
                  { name: "המשך בקצב הנוכחי", color: "currentColor", v: vd.projSeries, w: 2.5, dash: "2 5", label: "קצב נוכחי" },
                ]} />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
