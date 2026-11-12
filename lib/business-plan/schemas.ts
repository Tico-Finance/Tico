import { z } from "zod";

// Server-side validation for everything the plan UI persists.

const num = z.number().finite();
const text = (max = 120) => z.string().max(max);

const caseType = z.object({
  id: text(40),
  n: text(),
  on: z.boolean(),
  fee: num, share: num, c1: num, c2: num, c3: num, lag: num, h: num,
  pay: z.enum(["upfront", "split", "three", "custom"]),
  pa: num, oa: num, pp: num, op: num, pe: num, oe: num,
  opCost: num,
});

const channel = z.object({
  n: text(), unit: text(40), on: z.boolean(),
  share: num, y: num, cost: num, h: num,
  custom: z.boolean().optional(),
});

const costItem = z.object({
  n: text(),
  kind: z.enum(["month", "hours", "case", "once"]),
  fm: num, fy: num, tm: num, ty: num,
  amt: num.optional(), hrs: num.optional(),
  hpm: num.optional(), rate: num.optional(), vat: z.boolean().optional(),
  share: num.optional(), rem: num.optional(),
  prices: z.record(z.string().max(40), num).optional(),
});

export const planSettingsSchema = z.object({
  done: z.boolean(),
  target: num, fixed: num, open: num, start: num, end: num.optional(), ref: num,
  hours: num, meetH: num, otherH: num,
  g: z.object({ c1: num, c2: num, c3: num }),
  types: z.array(caseType).min(1).max(30),
  chans: z.array(channel).min(1).max(30),
  costItems: z.array(costItem).max(60),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);
const count = num.min(0);

export const dayEntrySchema = z.object({
  date: dateKey,
  leads: count, meetings: count, submissions: count, signed: count, cash: count,
  notes: text(300).optional(),
  demo: z.boolean().optional(),
});

export const actionEntrySchema = z.object({
  id: z.string().min(1).max(40),
  date: dateKey,
  name: text(), unit: text(40),
  units: count, cost: count, hours: count, leads: count, deals: count,
  demo: z.boolean().optional(),
});

export const expenseEntrySchema = z.object({
  key: monthKey,
  amount: count,
  note: text(300).optional(),
});

export const entrySchemas = {
  day: dayEntrySchema,
  action: actionEntrySchema,
  expense: expenseEntrySchema,
} as const;

export type EntryKind = keyof typeof entrySchemas;
export const entryKeyOf = {
  day: (e: z.infer<typeof dayEntrySchema>) => e.date,
  action: (e: z.infer<typeof actionEntrySchema>) => e.id,
  expense: (e: z.infer<typeof expenseEntrySchema>) => e.key,
};
