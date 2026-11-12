"use client";

import type { PlanSettings } from "@/lib/business-plan/types";
import type { Params, Plan, TypePlan } from "@/lib/business-plan/model";
import { MONTHS, dec, kfmt, money, nf, cnt } from "@/lib/business-plan/format";
import { WPM } from "@/lib/business-plan/dates";
import { BarChart, LineChart } from "./charts";
import { Card, Legend, Num, Pill, Seg } from "./ui";
import { Timeline } from "./timeline";

const tcolor = (ix: number) => `var(--pl-t${(ix % 10) + 1})`;

const SCEN = [
  { k: 0.5, label: "חצי מהיעד", card: "אם אגיע לחצי מהיעד", color: "var(--pl-s50)" },
  { k: 1, label: "היעד", card: "אם אגיע ליעד", color: "var(--pl-s100)" },
  { k: 1.5, label: "פי 1.5", card: "אם אגיע לפי 1.5", color: "var(--pl-s150)" },
];

export default function TabPlan({
  S, p, plans, K, setK, setTarget, openStep,
}: {
  S: PlanSettings;
  p: Params;
  plans: Plan[];
  K: number;
  setK: (k: number) => void;
  setTarget: (n: number) => void;
  openStep: (n: number) => void;
}) {
  const cur = plans.find((x) => x.k === K) ?? plans[1];
  const P1 = plans[1];
  const mname = (m: number) => MONTHS[(p.start + m) % 12];
  const endName = (i: number) => "סוף " + mname(i - 1);
  const w = cur.wk;
  const load = w.total / p.hours;
  const perChan = (units: string[]) => cur.chans.filter((c) => units.includes(c.unit)).reduce((a, c) => a + c.units / 52, 0);
  const posts = perChan(["פוסט"]), vids = perChan(["סרטון"]);
  const avgConv = P1.types.reduce((a, t) => a + t.s * t.conv, 0) * 100;
  const costMin = Math.min(...P1.costM), costMax = Math.max(...P1.costM);
  const hrsCase = (t: TypePlan) => t.h + p.meetH / (t.c2 * t.c3);
  const perH = (t: TypePlan) => t.fee / hrsCase(t);
  const ts = cur.types.slice().sort((a, b) => b.cases - a.cases);
  const maxC = Math.max(...ts.map((t) => t.cases), 1);
  const byH = ts.slice().sort((a, b) => perH(b) - perH(a));
  const round10 = (n: number) => Math.round(n / 10) * 10;

  const chips: [number, string, string][] = [
    [1, "היעד", money(S.target)],
    [1, "הוצאות", costMin === costMax ? `${money(costMin)} בחודש` : `${money(costMin)} עד ${money(costMax)}`],
    [2, "סוגי תיקים", `${p.types.length} סוגים`],
    [3, "זמן וגבייה", `${Math.round(P1.upfrontShare * 100)}% מראש`],
    [4, "המרות", `${dec(avgConv)}% ליד ללקוח`],
    [5, "לידים ותוכן", `${p.chans.length} ערוצים`],
  ];

  const hoursParts = [
    { n: "טיפול בתיקים", v: w.case, c: "var(--pl-t1)" },
    { n: "פגישות", v: w.meetings, c: "var(--pl-t2)" },
    { n: "תוכן ושיווק", v: w.content, c: "var(--pl-t3)" },
    { n: "אחר", v: w.other, c: "var(--pl-t5)" },
  ];
  const hScale = Math.max(w.total, p.hours) * 1.08;

  const N = p.months;
  const monthLabels = Array.from({ length: N }, (_, m) => mname(m));
  const hrsPill = w.total <= p.hours ? <Pill tone="good">✓ בתוך הקיבולת</Pill> : <Pill tone="bad">✕ חריגה של <Num>{dec(w.total - p.hours)}</Num> שעות</Pill>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-foreground/55">ההגדרות שלי:</span>
        {chips.map(([n, t, v]) => (
          <button key={t} type="button" onClick={() => openStep(n)}
            className="flex flex-col items-start rounded-xl border border-black/10 bg-surface px-3 py-1.5 text-start hover:border-primary">
            <span className="text-xs text-foreground/55">{t}</span>
            <b className="text-sm">{v}</b>
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <label htmlFor="plan-target" className="text-xl font-bold">כמה אני רוצה שייכנס לי השנה?</label>
        <div className="pl-bigin">
          <span>₪</span>
          <input id="plan-target" type="number" inputMode="numeric" step={10000} value={S.target}
            onChange={(e) => setTarget(Math.max(+e.target.value || 0, 0))} />
        </div>
        <input type="range" min={150000} max={1500000} step={10000} value={Math.min(Math.max(S.target, 150000), 1500000)}
          aria-label="יעד הכנסה שנתי" onChange={(e) => setTarget(+e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-foreground/70">ואם אסיים את השנה עם</span>
          <Seg value={K} onChange={setK} label="בחירת תרחיש" options={SCEN.map((s) => ({ v: s.k, label: s.label }))} />
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-extrabold text-primary">מה צריך לקרות כדי שזה יקרה</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {[
            ["לקוחות חדשים", cnt(cur.cases), `${N === 12 ? "בשנה" : "בתקופה"}, בערך ${cnt(cur.cases / N)} בחודש`],
            ["לידים חדשים", cnt(w.leads), "בשבוע"],
            ["פגישות", cnt(w.meet), "בשבוע"],
            ["תוכן לפרסם", cnt(posts + vids), "פוסטים וסרטונים בשבוע"],
          ].map(([t, v, s]) => (
            <div key={t} className="flex flex-col rounded-2xl border border-black/5 bg-surface p-5">
              <b className="num text-4xl font-extrabold leading-none">{v}</b>
              <span className="mt-1 font-semibold">{t}</span>
              <small className="text-xs text-foreground/55">{s}</small>
            </div>
          ))}
        </div>
        <Card className="flex flex-col gap-1.5 text-base leading-relaxed">
          <p>
            {load <= 0.85 ? <Pill tone="good">✓ ריאלי</Pill> : load <= 1 ? <Pill tone="warn">▲ צפוף</Pill> : <Pill tone="bad">✕ יותר מדי לבד</Pill>}{" "}
            זה בערך <Num>{dec(w.total)}</Num> שעות עבודה בשבוע, מתוך <Num>{dec(p.hours)}</Num> שעות פנויות.
            {load > 1 ? " כדאי להוסיף עזרה או להקטין את כמות התוכן." : load > 0.85 ? " אפשרי, אבל אין הרבה מרווח." : ""}
          </p>
          <p>
            אחרי כל ההוצאות {cur.net >= 0 ? "נשאר בכיס" : "חסרים"} <b><Num>{money(Math.abs(cur.net))}</Num></b>{" "}
            {cur.net >= 0 ? <Pill tone="good">✓ רווח</Pill> : <Pill tone="bad">✕ גירעון</Pill>}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-primary">איך הכסף נכנס לאורך השנה</h2>
        <Card>
          <Legend items={[{ t: "כסף שנכנס", color: "var(--pl-money)" }, { t: "הוצאות (כולל עובדים ומתפעלים שהוספת)", color: "currentColor", kind: "dash" }]} />
          <BarChart aria="כסף שנכנס בכל חודש מול הוצאות" labels={monthLabels} yFmt={kfmt} tipFmt={(v) => "₪" + nf(v)} tipTitle={(i) => monthLabels[i]}
            line={{ name: "הוצאות", v: cur.costM.slice(0, N).map((c) => c + cur.marketing / N) }}
            series={[{ name: "נכנס בחודש", color: "var(--pl-money)", v: cur.tot.income.slice(0, N) }]} />
          <p className="mt-2 text-foreground/70">
            {cur.dip < 0
              ? <>בחודשים הראשונים יהיה לחוץ: הנקודה הנמוכה ביותר היא מינוס <Num>{money(Math.abs(cur.dip))}</Num> ב{endName(cur.iMin)}. כדאי להיות מוכן לזה.</>
              : "התזרים חיובי לאורך כל השנה."}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-primary">ואם יוצא אחרת?</h2>
        <p className="text-foreground/70">לחיצה על תרחיש מחשבת מחדש את כל התוכנית.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {plans.map((s, i) => (
            <button key={s.k} type="button" aria-pressed={s.k === K} onClick={() => setK(s.k)}
              className="flex flex-col gap-1.5 rounded-2xl border-2 bg-surface p-4 text-start"
              style={{ borderColor: s.k === K ? "var(--pl-accent)" : "var(--pl-line)" }}>
              <span className="text-sm font-semibold text-foreground/70">{SCEN[i].card}</span>
              <span className="num text-3xl font-extrabold leading-tight">{money(s.income)}</span>
              <span className="text-sm text-foreground/70">
                {s.net >= 0 ? "נשאר בכיס" : "חסרים"} <b><Num>{money(Math.abs(s.net))}</Num></b>{" "}
                {s.net >= 0 ? <Pill tone="good">✓</Pill> : <Pill tone="bad">✕</Pill>}
              </span>
              <span className="text-sm text-foreground/70">
                <Num>{dec(s.wk.total)}</Num> שעות בשבוע {s.wk.total <= p.hours ? <Pill tone="good">✓</Pill> : <Pill tone="bad">✕ חריגה</Pill>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-primary">אילו תיקים לסגור</h2>
        <Card>
          <div className="flex flex-col gap-3.5">
            {ts.map((t) => (
              <div key={t.id} className="grid grid-cols-[minmax(120px,170px)_1fr_auto] items-center gap-3 max-sm:grid-cols-[1fr_auto]">
                <div className="font-semibold leading-tight">{t.n}<small className="block text-xs font-normal text-foreground/55">עמלה <Num>{money(t.fee)}</Num></small></div>
                <div className="h-3.5 overflow-hidden rounded-full max-sm:order-3 max-sm:col-span-2" style={{ background: "var(--pl-soft)" }}>
                  <i className="block h-full rounded-full" style={{ width: `${(t.cases / maxC) * 100}%`, background: tcolor(t.ix) }} />
                </div>
                <b className="num min-w-[2.4ch] text-end text-2xl font-extrabold">{cnt(t.cases)}</b>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-foreground/70">
            הכי משתלם לשעת עבודה: <b>{byH[0].n}</b> (כ-<Num>{money(round10(perH(byH[0])))}</Num> לשעה). הכי פחות: <b>{byH[byH.length - 1].n}</b> (כ-<Num>{money(round10(perH(byH[byH.length - 1])))}</Num>).
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold text-primary">רוצה לראות יותר?</h2>

        <More title="תוכן ולידים" sub="כמה פוסטים, סרטונים והרצאות, ומאיפה יגיעו הלידים">
          <Card className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th>ערוץ</th><th>לידים בשנה</th><th>יחידות בשנה</th><th>קצב</th><th>עלות בשנה</th><th>שעות בשבוע</th></tr></thead>
              <tbody>
                <tr><th scope="row">הפניות מלקוחות קיימים</th><td className="v"><Num>{cnt(cur.refLeads)}</Num></td><td className="v">—</td><td className="text-xs text-foreground/55"><Num>{p.ref}</Num> לכל תיק חתום</td><td className="v"><Num>{money(0)}</Num></td><td className="v">—</td></tr>
                {cur.chans.map((c) => (
                  <tr key={c.n}>
                    <th scope="row">{c.n}</th>
                    <td className="v"><Num>{cnt(c.leads)}</Num></td>
                    <td className="v"><Num>{cnt(c.units)}</Num> {c.unit}</td>
                    <td>{c.units / 52 >= 1 ? <><Num>{cnt(c.units / 52)}</Num> בשבוע</> : c.units > 0 ? <>אחת ל-<Num>{Math.round(52 / c.units)}</Num> שבועות</> : "0"}</td>
                    <td className="v"><Num>{money(c.cost)}</Num></td>
                    <td className="v"><Num>{dec(c.hours / 52)}</Num></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th scope="row">סה״כ</th><td><Num>{cnt(cur.leads)}</Num></td><td /><td /><td><Num>{money(cur.marketing)}</Num></td><td><Num>{dec(w.content)}</Num></td></tr></tfoot>
            </table>
          </Card>
          <Card>
            <h3 className="font-bold">שעות עבודה בשבוע: <Num>{dec(w.total)}</Num> מתוך <Num>{dec(p.hours)}</Num> {hrsPill}</h3>
            <div className="relative my-5 flex h-[30px] rounded-md" style={{ background: "var(--pl-soft)" }} role="img" aria-label="התפלגות שעות עבודה שבועיות">
              {hoursParts.map((x) => (
                <span key={x.n} className="block h-full first:rounded-e-md" style={{ width: `${(x.v / hScale) * 100}%`, background: x.c }} />
              ))}
              <div className="absolute -bottom-2 -top-2 w-0.5 bg-foreground" style={{ insetInlineStart: `${(p.hours / hScale) * 100}%` }}>
                <em className="absolute -top-[17px] ms-1.5 whitespace-nowrap text-[11px] font-bold not-italic">זמינות <Num>{dec(p.hours)}</Num></em>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
              {hoursParts.map((x) => (
                <span key={x.n}><i className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm align-baseline" style={{ background: x.c }} />{x.n} <Num>{dec(x.v)}</Num></span>
              ))}
            </div>
            <p className="mt-2.5 text-sm text-foreground/60">
              {w.total > p.hours
                ? "התוכנית בלתי ריאלית לבד. אפשר להוסיף עובד בהגדרות ההוצאות, להקטין את כמות הערוצים או להעלות את העמלות."
                : <>יש מרווח של <Num>{dec(p.hours - w.total)}</Num> שעות בשבוע לפני שמגיעים לתקרה.</>}
            </p>
          </Card>
        </More>

        <More title="המשפך ושבוע רגיל" sub="מליד ללקוח, ומה זה אומר לשבוע אחד">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
            <Card>
              <h3 className="mb-3.5 font-bold">שנה קדימה</h3>
              <div className="flex flex-col gap-2.5">
                {([["לידים", cur.leads, null], ["פגישות", cur.meet, cur.meet / cur.leads], ["לקוחות חדשים", cur.cases, cur.cases / cur.meet]] as [string, number, number | null][]).map(([l, v, r]) => (
                  <div key={l} className="grid grid-cols-[110px_1fr_140px] items-center gap-3 max-sm:grid-cols-[1fr_auto]">
                    <b className="text-sm">{l}</b>
                    <div className="h-6 overflow-hidden rounded max-sm:order-3 max-sm:col-span-2" style={{ background: "var(--pl-soft)" }}>
                      <i className="block h-full rounded-s" style={{ width: `${(v / cur.leads) * 100}%`, background: "var(--pl-accent)" }} />
                    </div>
                    <span className="text-xs text-foreground/70"><b className="num text-sm text-foreground">{cnt(v)}</b>{r != null && <> · המרה <Num>{Math.round(r * 100)}%</Num></>}</span>
                  </div>
                ))}
                <p className="text-xs text-foreground/55"><Num>{cnt(cur.refLeads)}</Num> מתוך הלידים מגיעים מהפניות, והשאר מהערוצים.</p>
              </div>
            </Card>
            <Card>
              <h3 className="mb-3.5 font-bold">שבוע רגיל</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
                {([["לידים חדשים", w.leads], ["פגישות", w.meet], ["לקוחות חדשים", w.cases]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="rounded-lg p-3" style={{ background: "var(--pl-soft)" }}>
                    <span className="block text-xs text-foreground/70">{l}</span><b className="text-lg"><Num>{cnt(v)}</Num> בשבוע</b>
                  </div>
                ))}
                <div className="rounded-lg p-3" style={{ background: "var(--pl-soft)" }}>
                  <span className="block text-xs text-foreground/70">בחודש</span>
                  <b className="text-lg"><Num>{cnt(w.leads * WPM)}</Num> לידים · <Num>{cnt(w.cases * WPM)}</Num> לקוחות</b>
                </div>
              </div>
            </Card>
          </div>
        </More>

        <More title="כל סוג עסקה: ציר זמן ורווחיות" sub="מתי נכנס הכסף, ומה משתלם יותר לשעת עבודה">
          <p className="text-sm text-foreground/60">ציר הזמן מראה מתי נכנס כסף מרגע שהליד מגיע. עיגול הוא גבייה, מעוין הוא חתימה.</p>
          <Card className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th>סוג תיק</th><th className="min-w-[300px]">ציר זמן (חודשים מהליד)</th><th>ממוצע עד כסף</th><th>שווי ליד</th><th>עמלה לשעה</th></tr></thead>
              <tbody>
                {P1.types.map((t) => (
                  <tr key={t.id}>
                    <th scope="row"><span className="me-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tcolor(t.ix) }} />{t.n}<br /><span className="text-xs font-normal text-foreground/55"><Num>{money(t.fee)}</Num> · מקדמה <Num>{Math.round(t.upfront * 100)}%</Num></span></th>
                    <td><Timeline lag={t.lag} pay={t.pay} /></td>
                    <td className="v"><Num>{dec(t.delay)}</Num> חודשים</td>
                    <td className="v"><Num>{money(t.conv * t.fee)}</Num></td>
                    <td className="v"><Num>{money(perH(t))}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th>סוג תיק</th><th>עמלה</th><th>תיקים</th><th>הכנסה</th><th className="min-w-[110px]">חלק מההכנסה</th><th>לידים</th><th>פגישות</th></tr></thead>
              <tbody>
                {ts.map((t) => (
                  <tr key={t.id}>
                    <th scope="row"><span className="me-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tcolor(t.ix) }} />{t.n}</th>
                    <td className="v"><Num>{money(t.fee)}</Num></td><td className="v"><Num>{cnt(t.cases)}</Num></td><td className="v"><Num>{money(t.income)}</Num></td>
                    <td><span className="block h-2 min-w-[2px] rounded-sm" style={{ width: `${Math.max((t.income / cur.income) * 100, 1)}%`, background: tcolor(t.ix) }} /><span className="text-xs text-foreground/55"><Num>{Math.round((t.income / cur.income) * 100)}%</Num></span></td>
                    <td className="v"><Num>{cnt(t.leads)}</Num></td><td className="v"><Num>{cnt(t.meet)}</Num></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th scope="row">סה״כ</th><td><Num>{money(cur.avgFee)}</Num></td><td><Num>{cnt(cur.cases)}</Num></td><td><Num>{money(cur.income)}</Num></td><td /><td><Num>{cnt(cur.leads)}</Num></td><td><Num>{cnt(cur.meet)}</Num></td></tr></tfoot>
            </table>
          </Card>
        </More>

        <More title="תחזית חודשית מפורטת" sub="לפי סוג תיק, בכל תרחיש, ובטבלה">
          <Card>
            <h3 className="mb-1.5 font-bold">הכנסה חודשית לפי סוג תיק</h3>
            <Legend items={cur.types.map((t) => ({ t: t.n, color: tcolor(t.ix) }))} />
            <BarChart aria="הכנסה חודשית לפי סוג תיק" labels={monthLabels} yFmt={kfmt} tipFmt={(v) => "₪" + nf(v)} tipTitle={(i) => monthLabels[i]}
              series={cur.types.map((t) => ({ name: t.n, color: tcolor(t.ix), v: t.cashM.slice(0, N) }))} />
          </Card>
          <Card>
            <h3 className="mb-1.5 font-bold">כמה נשאר בכיס לאורך הזמן, בכל תרחיש</h3>
            <Legend items={[{ t: "חצי מהיעד", color: "var(--pl-s50)", kind: "dash" }, { t: "היעד", color: "var(--pl-s100)", kind: "line" }, { t: "פי 1.5", color: "var(--pl-s150)", kind: "line" }]} />
            <LineChart aria="תוצאה מצטברת לפי תרחיש" count={N + 1} yFmt={kfmt} tipFmt={(v) => (v < 0 ? "−" : "") + "₪" + nf(Math.abs(v))}
              ticks={Array.from({ length: N }, (_, i) => ({ i, label: mname(i) }))} tipTitle={(i) => (i === 0 ? "נקודת פתיחה" : endName(i))}
              series={plans.slice().reverse().map((s) => {
                const sc = SCEN.find((x) => x.k === s.k)!;
                return { name: sc.label, color: sc.color, v: s.cum.slice(0, N + 1), w: s.k === 1 ? 3 : 2, dash: s.k < 1 ? "6 4" : undefined, label: sc.label };
              })} />
          </Card>
          <Card className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th>תוכנית חודשית · {SCEN.find((x) => x.k === cur.k)?.label}</th>{monthLabels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
              <tbody>
                {([
                  ["לידים", (m: number) => cnt(cur.tot.leads[m])],
                  ["פגישות", (m: number) => cnt(cur.tot.meet[m])],
                  ["לקוחות חדשים", (m: number) => cnt(cur.tot.signed[m])],
                  ["הכנסה", (m: number) => kfmt(cur.tot.income[m]), true],
                  ["הוצאות", (m: number) => kfmt(cur.costM[m] + cur.marketing / N)],
                  ["נטו בחודש", (m: number) => kfmt(cur.tot.income[m] - cur.costM[m] - cur.marketing / N)],
                  ["נטו מצטבר", (m: number) => kfmt(cur.cum[m + 1])],
                ] as [string, (m: number) => string, boolean?][]).map(([l, f, sep]) => (
                  <tr key={l} className={sep ? "sep" : undefined}>
                    <th scope="row">{l}</th>
                    {Array.from({ length: N }, (_, m) => <td key={m} className="v"><Num>{f(m)}</Num></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th /> {plans.map((s, i) => <th key={s.k}><span className="mb-2 block h-1 rounded" style={{ background: SCEN[i].color }} /><span className="block text-xl font-extrabold text-foreground">{SCEN[i].label}</span></th>)}</tr></thead>
              <tbody>
                {([
                  ["לקוחות חדשים", (s: Plan) => <Num key="a">{cnt(s.cases)}</Num>],
                  ["הכנסה שנתית (נכנסת לחשבון)", (s: Plan) => <Num key="b">{money(s.income)}</Num>],
                  ["הוצאות (קבועות, צוות ופרסום)", (s: Plan) => <Num key="c">{money(s.costs)}</Num>],
                  ["תוצאה בסוף השנה", (s: Plan) => <><Num>{money(s.net)}</Num> {s.net >= 0 ? <Pill tone="good">✓ רווח</Pill> : <Pill tone="bad">✕ גירעון</Pill>}</>, true],
                  ["הנקודה הנמוכה בשנה", (s: Plan) => (s.dip < 0 ? <><Num>{money(s.dip)}</Num> <span className="text-xs text-foreground/55">({endName(s.iMin)})</span></> : "אין")],
                  ["לידים בשבוע", (s: Plan) => <Num key="d">{cnt(s.wk.leads)}</Num>, true],
                  ["פגישות בשבוע", (s: Plan) => <Num key="e">{cnt(s.wk.meet)}</Num>],
                  ["שעות תוכן ושיווק בשבוע", (s: Plan) => <Num key="f">{dec(s.wk.content)}</Num>],
                  [`סך שעות עבודה בשבוע (זמינות ${dec(p.hours)})`, (s: Plan) => <><Num>{dec(s.wk.total)}</Num> {s.wk.total <= p.hours ? <Pill tone="good">✓</Pill> : <Pill tone="bad">✕ חריגה</Pill>}</>],
                ] as [string, (s: Plan) => React.ReactNode, boolean?][]).map(([l, f, sep]) => (
                  <tr key={l} className={sep ? "sep" : undefined}>
                    <th scope="row">{l}</th>
                    {plans.map((s) => <td key={s.k} className="v">{f(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </More>
      </section>

      <ul className="max-w-3xl list-disc ps-5 text-xs text-foreground/50">
        <li>ההכנסה נספרת בחודש שבו הכסף נגבה, לפי אחוזי הגבייה והחודשים שהגדרת לכל סוג תיק (החודש נספר מרגע קבלת הליד). נספרת רק גבייה מלקוחות שנחתמו, ובתיקים הפתוחים נספרת רק היתרה שעוד לא נגבתה.</li>
        <li>אחוזי ההמרה קבועים לאורך השנה, ובחודשי הקיץ יש פחות לידים. תרחיש &quot;חצי&quot; ו&quot;פי 1.5&quot; מכפילים את כל הפעילות.</li>
        <li>ההוצאות כוללות הוצאות קבועות, צוות ומתפעלים שהגדרת, ופרסום ממומן. התשלום למתפעל נחשב ביום שהליד הופך ללקוח.</li>
      </ul>
    </div>
  );
}

function More({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-black/5 bg-surface shadow-sm">
      <summary className="relative flex cursor-pointer list-none flex-col px-5 py-4 pe-12 [&::-webkit-details-marker]:hidden">
        <b className="text-base">{title}</b>
        <span className="text-sm text-foreground/60">{sub}</span>
        <span className="absolute end-5 top-1/2 -mt-2.5 text-lg text-foreground/50 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex min-w-0 flex-col gap-4 px-5 pb-5">{children}</div>
    </details>
  );
}
