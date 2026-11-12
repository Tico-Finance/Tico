import type { CaseType, Channel, PlanSettings, PayPreset } from "./types";

// Illustrative starting assumptions. Every value is editable in the wizard.
const BASE_TYPES: Omit<CaseType, "id" | "on" | "pa" | "oa" | "pp" | "op" | "pe" | "oe">[] = [
  { n: "רכישה – דירה ראשונה", fee: 12000, share: 25, c1: 40, c2: 60, c3: 80, lag: 3, h: 14, pay: "upfront", opCost: 2500 },
  { n: "רכישה – דירה חלופית", fee: 11000, share: 20, c1: 40, c2: 60, c3: 80, lag: 3, h: 14, pay: "upfront", opCost: 2500 },
  { n: "משקיעים", fee: 10000, share: 10, c1: 35, c2: 55, c3: 75, lag: 3, h: 12, pay: "custom", opCost: 2500 },
  { n: "מחזור משכנתא", fee: 7000, share: 30, c1: 50, c2: 70, c3: 85, lag: 2, h: 8, pay: "upfront", opCost: 2000 },
  { n: "משכנתא לכל מטרה", fee: 6500, share: 15, c1: 45, c2: 65, c3: 80, lag: 2, h: 8, pay: "split", opCost: 3750 },
];

/** Additional case types from the case-operator price list (fees are placeholders). */
export const TYPE_PRESETS = [
  { n: "הרחבה / בנייה עצמית", fee: 10000, opCost: 3500, lag: 4 },
  { n: "שיפוץ + מיחזור", fee: 9000, opCost: 3750, lag: 3 },
  { n: "גרירה + תוספת", fee: 9000, opCost: 3750, lag: 3 },
  { n: "איחוד הלוואות + מיחזור בנקאי", fee: 9000, opCost: 3750, lag: 2 },
  { n: "משכנתא הפוכה", fee: 8000, opCost: 2500, lag: 2 },
  { n: "חוץ בנקאי", fee: 12000, opCost: 4500, lag: 3 },
  { n: "משכנתא לתושבי חוץ", fee: 14000, opCost: 5000, lag: 4 },
  { n: "משכנתא עסקית", fee: 18000, opCost: 7000, lag: 4 },
] as const;

export const DEFAULT_CHANNELS: Channel[] = [
  { n: "פוסטים בקבוצות וקהילות", unit: "פוסט", on: true, share: 30, y: 0.5, cost: 0, h: 0.75 },
  { n: "סרטונים קצרים", unit: "סרטון", on: true, share: 25, y: 1.2, cost: 0, h: 3 },
  { n: "הרצאות לארגונים", unit: "הרצאה", on: true, share: 20, y: 6, cost: 0, h: 4 },
  { n: "פרסום ממומן", unit: "ליד", on: true, share: 15, y: 1, cost: 90, h: 0.05 },
  { n: "שותפויות (מתווכים, עו״ד)", unit: "פגישה", on: true, share: 10, y: 1.5, cost: 0, h: 1.5 },
];

/** Fill the pa/oa/pp/op/pe/oe fields from a payment preset (months counted from the lead). */
export function applyPay(t: CaseType): void {
  const L = t.lag;
  const cl = (x: number) => Math.min(x, 9);
  const set = (pa: number, pp: number, pe: number, opM: number, oeM: number) =>
    Object.assign(t, { pa, oa: 1, pp, op: cl(opM), pe, oe: cl(oeM) });
  if (t.pay === "upfront") set(100, 0, 0, L, L + 1);
  else if (t.pay === "split") set(50, 0, 50, L, L + 1);
  else if (t.pay === "three") set(40, 30, 30, L, L + 2);
}

export function newCaseType(
  p: { n: string; fee: number; opCost: number; lag: number },
  g: { c1: number; c2: number; c3: number },
  id: string
): CaseType {
  const t: CaseType = {
    id, on: true, n: p.n, fee: p.fee, share: 5, c1: g.c1, c2: g.c2, c3: g.c3,
    lag: p.lag, h: 10, pay: "upfront", pa: 100, oa: 1, pp: 0, op: 3, pe: 0, oe: 4, opCost: p.opCost,
  };
  applyPay(t);
  return t;
}

export function defaultSettings(today: Date): PlanSettings {
  const types: CaseType[] = BASE_TYPES.map((b, i) => {
    const t: CaseType = { ...b, id: `d${i}`, on: true, pa: 100, oa: 1, pp: 0, op: 3, pe: 0, oe: 4 };
    if (b.pay === "custom") Object.assign(t, { pa: 60, oa: 1, pp: 20, op: 3, pe: 20, oe: 5 });
    else applyPay(t);
    return t;
  });
  return {
    done: false,
    target: 500000,
    fixed: 25000,
    open: 4,
    start: today.getMonth(),
    end: 11,
    ref: 0.3,
    hours: 45,
    meetH: 1.5,
    otherH: 12,
    g: { c1: 40, c2: 60, c3: 80 },
    types,
    chans: DEFAULT_CHANNELS.map((c) => ({ ...c })),
    costItems: [],
  };
}

export const PAY_LABELS: Record<PayPreset, string> = {
  upfront: "100% מראש",
  split: "מקדמה וביצוע",
  three: "שלוש פעימות",
  custom: "אחר",
};
