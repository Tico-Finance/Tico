// Shared types for the business-plan module (settings + logged entries).

export type PayPreset = "upfront" | "split" | "three" | "custom";

export interface CaseType {
  id: string;
  n: string;
  on: boolean;
  /** Our fee per signed case (₪). */
  fee: number;
  /** Share of all cases (any scale, normalized when used). */
  share: number;
  /** Conversion percentages (1-100): lead→meeting, meeting→submission, submission→signing. */
  c1: number;
  c2: number;
  c3: number;
  /** Months from lead to signing. */
  lag: number;
  /** Our own handling hours per case. */
  h: number;
  /** Collection schedule: % and month-from-lead for advance / progress / execution. */
  pay: PayPreset;
  pa: number;
  oa: number;
  pp: number;
  op: number;
  pe: number;
  oe: number;
  /** Default per-case price list entry for a case operator (₪). */
  opCost: number;
}

export interface Channel {
  n: string;
  unit: string;
  on: boolean;
  /** Share of non-referral leads (any scale, normalized). */
  share: number;
  /** Leads per unit. */
  y: number;
  /** Cost per unit (₪). */
  cost: number;
  /** Hours per unit. */
  h: number;
  custom?: boolean;
}

export type CostKind = "month" | "hours" | "case" | "once";

export interface CostItem {
  n: string;
  kind: CostKind;
  /** Start month (0-11) and year; end month (-1 = open ended) and year. */
  fm: number;
  fy: number;
  tm: number;
  ty: number;
  /** month / once: amount (₪). */
  amt?: number;
  /** month: weekly hours this adds. */
  hrs?: number;
  /** hours package: hours per month, price per hour, +VAT. */
  hpm?: number;
  rate?: number;
  vat?: boolean;
  /** case operator: share of cases routed to them (%), hours still spent per case, price per case type id. */
  share?: number;
  rem?: number;
  prices?: Record<string, number>;
}

export interface PlanSettings {
  done: boolean;
  target: number;
  fixed: number;
  open: number;
  /** Month (0-11) the 12-month plan starts at. */
  start: number;
  /** Last month (0-11) of the plan; the plan runs from `start` to here within one calendar year. Defaults to December. */
  end?: number;
  /** Leads that come from referrals, per signed case. */
  ref: number;
  hours: number;
  meetH: number;
  otherH: number;
  g: { c1: number; c2: number; c3: number };
  types: CaseType[];
  chans: Channel[];
  costItems: CostItem[];
}

export interface DayEntry {
  date: string; // YYYY-MM-DD
  leads: number;
  meetings: number;
  submissions: number;
  signed: number;
  cash: number;
  notes?: string;
  demo?: boolean;
}

export interface ActionEntry {
  id: string;
  date: string;
  name: string;
  unit: string;
  units: number;
  cost: number;
  hours: number;
  leads: number;
  deals: number;
  demo?: boolean;
}

export interface ExpenseEntry {
  key: string; // YYYY-MM
  amount: number;
  note?: string;
}

export interface PlanData {
  settings: PlanSettings | null;
  days: Record<string, DayEntry>;
  actions: Record<string, ActionEntry>;
  expenses: Record<string, ExpenseEntry>;
}
