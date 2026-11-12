import type { ActionEntry, DayEntry, ExpenseEntry } from "./types";
import type { Plan, Totals } from "./model";
import { WPM, addD, dim, dk, monthIndex, monthKey, startOfDay } from "./dates";
import { MONTHS } from "./format";

export type Win = "day" | "week" | "month" | "all";
export type Hor = "month" | "quarter" | "year" | "plan";
export type Days = Record<string, DayEntry>;
export type Expenses = Record<string, ExpenseEntry>;

/** Plan metric (key in Plan.tot) → the matching field in a logged day. */
export const METRICS: { key: keyof Totals; field: keyof Pick<DayEntry, "leads" | "meetings" | "submissions" | "signed" | "cash">; label: string }[] = [
  { key: "leads", field: "leads", label: "לידים חדשים" },
  { key: "meet", field: "meetings", label: "פגישות" },
  { key: "sub", field: "signed", label: "הסכמי התקשרות שנחתמו" },
  { key: "signed", field: "submissions", label: "תיקים שהוגשו לבנקים" },
  { key: "income", field: "cash", label: "כסף שנכנס" },
];

export function winRange(w: Win, today: Date, ps: Date): [Date, Date, string] {
  const t = startOfDay(today);
  if (w === "day") return [t, t, "היום"];
  if (w === "week") return [addD(t, -t.getDay()), t, "השבוע, מיום ראשון"];
  if (w === "month") return [new Date(t.getFullYear(), t.getMonth(), 1), t, "החודש"];
  return [ps, t, "מתחילת התוכנית"];
}

/** Plan total of a metric between two dates (each month's plan spread evenly over its days). */
export function planSum(P: Plan, key: keyof Totals, a: Date, b: Date, ps: Date): number {
  let s = 0;
  for (let d = new Date(a); d <= b; d = addD(d, 1)) {
    const m = monthIndex(d, ps);
    if (m < 0 || m > 11) continue;
    s += P.tot[key][m] / dim(d.getFullYear(), d.getMonth());
  }
  return s;
}

export function actSum(days: Days, field: (typeof METRICS)[number]["field"], a: Date, b: Date): number {
  const ka = dk(a), kb = dk(b);
  let s = 0;
  for (const k in days) if (k >= ka && k <= kb) s += +days[k][field] || 0;
  return s;
}

export function statusOf(r: number): "good" | "warn" | "bad" {
  return r >= 0.9 ? "good" : r >= 0.6 ? "warn" : "bad";
}

/** Cost of a plan month: the actual expense if it was entered for a past/current month, else the plan. */
export function effCost(P: Plan, m: number, ps: Date, expenses: Expenses, today: Date): number {
  const d = new Date(ps.getFullYear(), ps.getMonth() + m, 1);
  const a = expenses[monthKey(d)];
  return a && d <= today && a.amount != null ? +a.amount : P.costM[m] + P.marketing / 12;
}

export function costSum(P: Plan, a: Date, b: Date, ps: Date, expenses: Expenses, today: Date): number {
  let s = 0;
  for (let d = new Date(a); d <= b; d = addD(d, 1)) {
    const m = monthIndex(d, ps);
    if (m < 0 || m > 11) continue;
    s += effCost(P, m, ps, expenses, today) / dim(d.getFullYear(), d.getMonth());
  }
  return s;
}

export function horizonEnd(h: Hor, ps: Date, today: Date): Date {
  const t = startOfDay(today);
  const cap = new Date(ps.getFullYear(), ps.getMonth() + 12, 0);
  let e: Date;
  if (h === "month") e = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  else if (h === "quarter") e = new Date(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3 + 3, 0);
  else if (h === "year") e = new Date(t.getFullYear(), 11, 31);
  else e = cap;
  return e > cap ? cap : e;
}

export const cumSigned = (P: Plan): number[] => {
  const c = [0];
  P.tot.signed.forEach((x) => c.push(c[c.length - 1] + x));
  return c;
};
export const atCum = (c: number[], weeks: number): number => {
  const x = Math.min(Math.max(weeks / WPM, 0), 12);
  const i = Math.floor(x);
  return i >= 12 ? c[12] : c[i] + (c[i + 1] - c[i]) * (x - i);
};

export interface WatchRow { label: string; key: keyof Totals; plan: number; act: number; ratio: number }
export function watchRows(P1: Plan, days: Days, win: Win, today: Date, ps: Date) {
  const [a, b, label] = winRange(win, today, ps);
  const rows: WatchRow[] = METRICS.map((m) => {
    const plan = planSum(P1, m.key, a, b, ps);
    const act = actSum(days, m.field, a, b);
    return { label: m.label, key: m.key, plan, act, ratio: plan > 0 ? act / plan : act > 0 ? 2 : 1 };
  });
  return { rows, label };
}

export interface ForecastRow { label: string; key: keyof Totals; act: number; cur: number; back: number; plan: number }
export interface Forecast {
  hE: Date;
  rows: ForecastRow[];
  pace: Record<string, number>;
  net: { plan: number; cur: number; back: number };
  young: boolean;
  chart: { labels: string[]; actual: number[]; projected: number[]; plan: number[] };
}

export function buildForecast(P1: Plan, days: Days, expenses: Expenses, hor: Hor, today: Date, ps: Date): Forecast | null {
  const t = startOfDay(today);
  const hE = horizonEnd(hor, ps, t);
  if (hE <= t) return null;
  const nextD = addD(t, 1);
  const ldPlan = planSum(P1, "leads", ps, t, ps);
  const ldPace = ldPlan >= 8 ? actSum(days, "leads", ps, t) / ldPlan : 1;
  const paceOf = (key: keyof Totals, field: (typeof METRICS)[number]["field"], minPlan: number) => {
    const pl = planSum(P1, key, ps, t, ps);
    return pl >= minPlan ? actSum(days, field, ps, t) / pl : ldPace;
  };
  const pace: Record<string, number> = {
    leads: paceOf("leads", "leads", 8),
    meet: paceOf("meet", "meetings", 4),
    sub: paceOf("sub", "signed", 3),
    signed: paceOf("signed", "submissions", 2),
    income: paceOf("income", "cash", 20000),
  };
  const rows: ForecastRow[] = METRICS.map((m) => {
    const plan = planSum(P1, m.key, ps, hE, ps);
    const act = actSum(days, m.field, ps, t);
    const rem = planSum(P1, m.key, nextD, hE, ps);
    return { label: m.label, key: m.key, act, cur: act + pace[m.key] * rem, back: act + rem, plan };
  });
  const costs = costSum(P1, ps, hE, ps, expenses, t);
  const inc = rows[4];
  const net = { plan: inc.plan - costs, cur: inc.cur - costs, back: inc.back - costs };

  const labels: string[] = [], actual: number[] = [], projected: number[] = [], plan: number[] = [];
  for (let m = 0; m < 12; m++) {
    const ms = new Date(ps.getFullYear(), ps.getMonth() + m, 1);
    const me = new Date(ps.getFullYear(), ps.getMonth() + m + 1, 0);
    if (ms > hE) break;
    const e = me > hE ? hE : me;
    labels.push(MONTHS[ms.getMonth()]);
    plan.push(planSum(P1, "income", ms, e, ps));
    actual.push(e < t ? actSum(days, "cash", ms, e) : ms <= t ? actSum(days, "cash", ms, t) : 0);
    const rs = ms > nextD ? ms : nextD;
    projected.push((e >= rs ? planSum(P1, "income", rs, e, ps) : 0) * pace.income);
  }
  return { hE, rows, pace, net, young: ldPlan < 8, chart: { labels, actual, projected, plan } };
}

export interface Verdict {
  pace: number;
  basis: "signed" | "leads";
  final: number;
  ratio: number;
  near: string;
  needPerMonth: number;
  weekNow: number;
  actualSeries: (number | null)[];
  projSeries: (number | null)[];
}
export function buildVerdict(plans: Plan[], days: Days, today: Date, ps: Date): Verdict {
  const t = startOfDay(today);
  const P1 = plans[1];
  const nDays = Math.round((t.getTime() - ps.getTime()) / 864e5);
  const weekNow = Math.min(52, Math.max(1, Math.floor(nDays / 7)));
  const planSig = planSum(P1, "signed", ps, t, ps);
  const actSig = actSum(days, "submissions", ps, t);
  const planLd = planSum(P1, "leads", ps, t, ps);
  const actLd = actSum(days, "leads", ps, t);
  const basis = planSig >= 1 ? "signed" : "leads";
  const pace = basis === "signed" ? actSig / planSig : planLd > 0 ? actLd / planLd : 1;
  const cP = cumSigned(P1);
  const Pl = (x: number) => atCum(cP, x);
  const actC = (i: number) => (i <= 0 ? 0 : actSum(days, "submissions", ps, i >= weekNow ? t : addD(ps, 7 * i - 1)));
  const aw = actC(weekNow);
  const final = basis === "signed" ? aw + pace * (Pl(52) - Pl(weekNow)) : P1.cases * pace;
  const ratio = final / P1.cases;
  const near = ratio < 0.5 ? "מתחת לתרחיש חצי" : ratio < 1 ? "בין חצי מהיעד ליעד" : ratio < 1.5 ? "בין היעד לפי 1.5" : "מעל פי 1.5";
  const left = Math.max(P1.cases - aw, 0);
  const leftM = Math.max(12 - nDays / 30.4, 0.5);
  const xs = Array.from({ length: 53 }, (_, i) => i);
  return {
    pace, basis, final, ratio, near, needPerMonth: left / leftM, weekNow,
    actualSeries: xs.map((i) => (i <= weekNow ? actC(i) : null)),
    projSeries: xs.map((i) => (i < weekNow ? null : i === weekNow ? aw : basis === "signed" ? aw + pace * (Pl(i) - Pl(weekNow)) : Pl(i) * pace)),
  };
}

/** Example data (clearly flagged `demo`) so the control tab has something to show. */
export function buildDemo(P1: Plan, today: Date, ps: Date): { days: DayEntry[]; actions: ActionEntry[] } {
  const t = startOfDay(today);
  const days: DayEntry[] = [];
  let n = 0;
  for (let i = 20; i >= 0; i--) {
    const d = addD(t, -i);
    if (d < ps || d.getDay() === 6) continue;
    const m = monthIndex(d, ps);
    if (m < 0 || m > 11) continue;
    const r = (k: keyof Totals) => ((P1.tot[k][m] / dim(d.getFullYear(), d.getMonth())) * 7) / 6;
    const w = 0.55 + ((i * 37) % 10) / 14;
    n++;
    const signed = n % 6 === 0 ? 1 : 0;
    days.push({
      date: dk(d), demo: true,
      leads: Math.round(r("leads") * w * 1.1),
      meetings: Math.round(r("meet") * w * 1.1),
      signed: Math.round(r("sub") * w),
      submissions: signed,
      cash: Math.round(signed * 9000 + r("income") * 0.3),
      notes: "",
    });
  }
  const actions: ActionEntry[] = [
    { id: "demo1", date: dk(addD(t, -9)), name: "דוח חניה על השמשה", unit: "דוח", units: 200, cost: 150, hours: 3, leads: 10, deals: 2, demo: true },
    { id: "demo2", date: dk(addD(t, -4)), name: "פוסטים בקבוצות וקהילות", unit: "פוסט", units: 12, cost: 0, hours: 9, leads: 7, deals: 1, demo: true },
  ];
  return { days, actions };
}
