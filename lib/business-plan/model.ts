import type { CaseType, Channel, PlanSettings } from "./types";
import { dim } from "./dates";

/** Seasonality of new leads by calendar month (Jan..Dec). */
export const SEAS = [1.0, 1.0, 1.1, 1.05, 1.0, 0.95, 0.8, 0.7, 1.15, 1.1, 1.0, 0.95];
const VAT = 1.18;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const clampPct = (x: number) => Math.min(Math.max(+x || 1, 1), 100) / 100;

export interface PType {
  ix: number;
  id: string;
  opCost: number;
  n: string;
  fee: number;
  share: number;
  c1: number;
  c2: number;
  c3: number;
  lag: number;
  h: number;
  pa: number;
  pp: number;
  pe: number;
  oa: number;
  op: number;
  oe: number;
}
export interface PChan {
  n: string;
  unit: string;
  share: number;
  y: number;
  cost: number;
  h: number;
}
export interface CaseItem {
  name: string;
  m0: number;
  m1: number;
  share: number;
  rem: number;
  prices: Record<string, number>;
}
export interface Params {
  start: number;
  /** How many months the plan covers, from `start` (1-12). */
  months: number;
  target: number;
  open: number;
  ref: number;
  hours: number;
  meetH: number;
  otherH: number;
  /** Fixed monthly cost per plan month (base + salaries, packages, one-offs). */
  costM: number[];
  fixedBreak: [string, number][][];
  caseItems: CaseItem[];
  types: PType[];
  chans: PChan[];
}

/** Validate/normalize stored settings into model parameters. `ps` is the plan's first day. */
export function buildParams(S: PlanSettings, ps: Date): Params {
  let ts = S.types.filter((t) => t.on);
  if (!ts.length) ts = [S.types[0]];
  let cs = S.chans.filter((c) => c.on);
  if (!cs.length) cs = [S.chans[0]];
  const anyT = ts.some((t) => +t.share > 0);
  const anyC = cs.some((c) => +c.share > 0);
  const base = +S.fixed || 0;
  const p0 = ps.getFullYear() * 12 + ps.getMonth();
  let hAdd = 0;
  const fixedBreak: [string, number][][] = Array.from({ length: 12 }, () => [["הוצאות קבועות", base]]);
  const caseItems: CaseItem[] = [];
  const costM = Array<number>(12).fill(base);
  for (const it of S.costItems ?? []) {
    const f = (+it.fy) * 12 + (+it.fm) - p0;
    const t = +it.tm >= 0 ? (+it.ty) * 12 + (+it.tm) - p0 : Infinity;
    const name = it.n || "הוצאה";
    if (it.kind === "case") {
      caseItems.push({
        name, m0: f, m1: t,
        share: it.share != null ? +it.share : 100,
        rem: it.rem != null ? +it.rem : 3,
        prices: it.prices ?? {},
      });
      continue;
    }
    for (let m = 0; m < 12; m++) {
      let amt = 0;
      if (it.kind === "once") {
        if (m === f) amt = +(it.amt ?? 0) || 0;
      } else if (m >= f && m <= t) {
        if (it.kind === "hours") {
          amt = (+(it.hpm ?? 0) || 0) * (+(it.rate ?? 0) || 0) * (it.vat ? VAT : 1);
          hAdd += (+(it.hpm ?? 0) || 0) / 4.345 / 12;
        } else {
          amt = +(it.amt ?? 0) || 0;
          hAdd += (+(it.hrs ?? 0) || 0) / 12;
        }
      }
      if (amt) {
        costM[m] += amt;
        fixedBreak[m].push([name, amt]);
      }
    }
  }
  const start = Math.min(Math.max(Math.round(+S.start || 0), 0), 11);
  const months = Math.min(Math.max(Math.round((S.end ?? 11) - start + 1), 1), 12);
  for (let m = months; m < 12; m++) { costM[m] = 0; fixedBreak[m] = []; }
  return {
    costM, fixedBreak, caseItems, months,
    target: +S.target || 0,
    open: +S.open || 0,
    start,
    ref: +S.ref || 0,
    hours: Math.max((+S.hours || 1) + hAdd, 1),
    meetH: +S.meetH || 0,
    otherH: +S.otherH || 0,
    types: ts.map((t: CaseType) => ({
      ix: S.types.indexOf(t),
      id: t.id,
      opCost: +t.opCost || 0,
      n: t.n || "סוג תיק",
      fee: Math.max(+t.fee || 1, 1),
      share: anyT ? +t.share || 0 : 1,
      // Submitting to a bank is not a funnel stage: a signed client is always submitted, so only two conversions count.
      c1: clampPct(t.c1), c2: clampPct(t.c2), c3: 1,
      lag: +t.lag || 1,
      h: +t.h || 0,
      pa: +t.pa || 0, pp: +t.pp || 0, pe: +t.pe || 0,
      oa: +t.oa || 0, op: +t.op || 0, oe: +t.oe || 0,
    })),
    chans: cs.map((c: Channel) => ({
      n: c.n, unit: c.unit,
      share: anyC ? +c.share || 0 : 1,
      y: Math.max(+c.y || 0.05, 0.05),
      cost: +c.cost || 0,
      h: +c.h || 0,
    })),
  };
}

export interface Pay { n: string; pct: number; off: number }
export const payOf = (t: { pa: number; pp: number; pe: number; oa: number; op: number; oe: number }): Pay[] => {
  const ps = ((+t.pa || 0) + (+t.pp || 0) + (+t.pe || 0)) || 1;
  return [
    { n: "מקדמה", pct: t.pa / ps, off: +t.oa },
    { n: "התקדמות", pct: t.pp / ps, off: +t.op },
    { n: "ביצוע", pct: t.pe / ps, off: +t.oe },
  ].filter((x) => x.pct > 0);
};

export interface TypePlan extends PType {
  s: number;
  conv: number;
  pay: Pay[];
  delay: number;
  upfront: number;
  leadsM: number[];
  signedM: number[];
  cashM: number[];
  cases: number;
  leads: number;
  meet: number;
  sub: number;
  income: number;
}
export interface ChanPlan extends PChan { leads: number; units: number; hours: number }
export interface Totals { leads: number[]; meet: number[]; sub: number[]; signed: number[]; income: number[] }
export interface Plan {
  k: number;
  types: TypePlan[];
  tot: Totals;
  avgFee: number;
  upfrontShare: number;
  cases: number;
  leads: number;
  meet: number;
  sub: number;
  income: number;
  refLeads: number;
  chans: ChanPlan[];
  marketing: number;
  costs: number;
  costM: number[];
  costBreak: [string, number][][];
  net: number;
  cum: number[];
  iMin: number;
  dip: number;
  weeks: number;
  wk: { leads: number; meet: number; sub: number; cases: number; content: number; case: number; meetings: number; other: number; total: number };
}

/** The full 12-month plan for a scenario multiplier `k` (0.5 = half of target, 1 = target...). */
export function buildPlan(p: Params, k: number): Plan {
  const N = p.months;
  const weeks = (N * 52) / 12;
  const w = Array.from({ length: 12 }, (_, m) => (m < N ? SEAS[(p.start + m) % 12] : 0));
  const sumShare = p.types.reduce((a, t) => a + t.share, 0) || 1;
  const Z = () => Array<number>(12).fill(0);

  const types: TypePlan[] = p.types.map((t) => {
    const pay = payOf(t);
    const ps = (t.pa + t.pp + t.pe) || 1;
    return {
      ...t, s: t.share / sumShare, conv: t.c1 * t.c2 * t.c3, pay,
      delay: pay.reduce((a, x) => a + x.pct * x.off, 0), upfront: t.pa / ps,
      leadsM: [], signedM: [], cashM: [], cases: 0, leads: 0, meet: 0, sub: 0, income: 0,
    };
  });

  // Cash still owed by cases that are already open, and cash per unit of new-lead volume.
  let C = 0;
  let openCash = 0;
  const openCashM = new Map<string, number[]>();
  for (const t of types) {
    const open = p.open * t.s;
    const remain = open * t.fee * (1 - t.upfront);
    const span = Math.max(1, Math.min(N, ...t.pay.map((x) => x.off)));
    openCashM.set(t.id, Z().map((_, m) => (m < span ? remain / span : 0)));
    openCash += remain;
    let u = 0;
    w.forEach((x, j) => t.pay.forEach((q) => { if (j + q.off <= N - 1) u += x * q.pct; }));
    C += t.s * t.fee * u;
  }
  const f = Math.max((p.target - openCash) / (C || 1), 0);

  const tot: Totals = { leads: Z(), meet: Z(), sub: Z(), signed: Z(), income: Z() };
  for (const t of types) {
    const open = p.open * t.s;
    t.leadsM = w.map((x) => (f * k * t.s * x) / t.conv);
    t.signedM = w.map((_, m) => (m >= N ? 0 : m < t.lag ? (open / t.lag) * k : t.leadsM[m - t.lag] * t.conv));
    t.cashM = (openCashM.get(t.id) ?? Z()).map((x) => x * k);
    t.leadsM.forEach((l, j) =>
      t.pay.forEach((q) => { if (j + q.off <= N - 1) t.cashM[j + q.off] += l * t.conv * t.fee * q.pct; })
    );
    t.cases = sum(t.signedM);
    t.leads = sum(t.leadsM);
    t.meet = t.leads * t.c1;
    t.sub = t.meet * t.c2;
    t.income = sum(t.cashM);
    for (let m = 0; m < 12; m++) {
      tot.leads[m] += t.leadsM[m];
      tot.meet[m] += t.leadsM[m] * t.c1;
      tot.sub[m] += t.leadsM[m] * t.c1 * t.c2;
      tot.signed[m] += t.signedM[m];
      tot.income[m] += t.cashM[m];
    }
  }

  const avgFee = types.reduce((a, t) => a + t.s * t.fee, 0);
  const upfrontShare = types.reduce((a, t) => a + t.s * t.fee * t.upfront, 0) / avgFee;
  const cases = sum(tot.signed), leads = sum(tot.leads), meet = sum(tot.meet), sub = sum(tot.sub), income = sum(tot.income);

  // Lead sources: referrals first, the rest split between channels.
  const refLeads = Math.min(p.ref * cases, leads);
  const chLeads = leads - refLeads;
  const chShare = p.chans.reduce((a, c) => a + c.share, 0) || 1;
  const chans: ChanPlan[] = p.chans.map((c) => {
    const l = (chLeads * c.share) / chShare;
    const u = l / c.y;
    return { ...c, leads: l, units: u, cost: u * c.cost, hours: u * c.h };
  });
  const marketing = sum(chans.map((c) => c.cost));
  const contentH = sum(chans.map((c) => c.hours));

  // Case operators: cost per signed case and hours they take off our plate.
  const nm = Array.from({ length: 12 }, (_, m) => {
    const act = p.caseItems.filter((i) => m >= i.m0 && m <= i.m1);
    const den = Math.max(100, act.reduce((x, i) => x + i.share, 0));
    return act.map((i) => ({ i, f: i.share / den }));
  });
  const priceOf = (i: CaseItem, t: TypePlan) => {
    const v = i.prices[t.id];
    return (v != null ? +v : t.opCost) || 0;
  };
  const Fm = (m: number) => nm[m].reduce((x, y) => x + y.f, 0);
  const remM = (m: number) => {
    const F = Fm(m);
    return F > 0 ? nm[m].reduce((x, y) => x + y.f * y.i.rem, 0) / F : 0;
  };
  const caseBreak: [string, number][][] = nm.map((arr, m) =>
    arr.map((x) => [x.i.name, sum(types.map((t) => t.signedM[m] * x.f * priceOf(x.i, t)))] as [string, number])
  );
  const caseCostM = caseBreak.map((a) => sum(a.map((x) => x[1])));
  const caseH = sum(types.map((t) => sum(t.signedM.map((x, m) => {
    const F = Fm(m);
    return x * (t.h * (1 - F) + Math.min(t.h, remM(m)) * F);
  }))));
  const meetH = meet * p.meetH;
  const otherH = p.otherH * weeks;
  const hoursYear = contentH + caseH + meetH + otherH;

  const costM = p.costM.map((c, m) => c + caseCostM[m]);
  const costs = sum(costM) + marketing;
  const netM = tot.income.map((x, m) => x - costM[m] - (m < N ? marketing / N : 0));
  const cum = [0];
  netM.forEach((x) => cum.push(cum[cum.length - 1] + x));
  let iMin = 0;
  cum.forEach((v, i) => { if (v < cum[iMin]) iMin = i; });

  return {
    k, weeks, types, tot, avgFee, upfrontShare, cases, leads, meet, sub, income, refLeads, chans, marketing,
    costs, costM,
    costBreak: p.fixedBreak.map((a, m) => a.concat(caseBreak[m].filter((x) => x[1] > 0))),
    net: income - costs, cum, iMin, dip: cum[iMin],
    wk: {
      leads: leads / weeks, meet: meet / weeks, sub: sub / weeks, cases: cases / weeks,
      content: contentH / weeks, case: caseH / weeks, meetings: meetH / weeks, other: p.otherH, total: hoursYear / weeks,
    },
  };
}

export { dim };
