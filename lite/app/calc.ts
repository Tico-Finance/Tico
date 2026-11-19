// חישוב מקוצר - אותם עקרונות כמו הכלי המלא: יחס החזר עד 38% מההכנסה הפנויה,
// תקרת מימון לפי סוג עסקה, ותמהיל ממוצע של ריבית צמודה ולא צמודה.
export type DealType = "first" | "replacement" | "investment";
export const DEAL_LABELS: Record<DealType, string> = {
  first: "דירה ראשונה / יחידה",
  replacement: "דירה חלופית",
  investment: "דירה להשקעה",
};
const LTV: Record<DealType, number> = { first: 0.75, replacement: 0.7, investment: 0.5 };
const PTI = 0.38;
const BLENDED_RATE = 0.34 * 0.028 + 0.66 * 0.045; // שנתי

export type Input = {
  age: number; income: number; obligations: number;
  propertyValue: number; equity: number; deal: DealType;
};

function factor(years: number) {
  const r = BLENDED_RATE / 12, n = years * 12;
  return (1 - Math.pow(1 + r, -n)) / r;
}

export function calc(i: Input) {
  const years = Math.min(30, Math.max(4, 75 - i.age));
  const disposable = Math.max(i.income - i.obligations, 0);
  const maxPayment = disposable * PTI;
  const byIncome = maxPayment * factor(years);
  const byLtv = i.propertyValue * LTV[i.deal];
  const maxMortgage = Math.max(Math.min(byIncome, byLtv), 0);
  const needed = Math.max(i.propertyValue - i.equity, 0);
  const payment = needed / factor(years);
  const ptiActual = disposable > 0 ? (payment / disposable) * 100 : 0;
  const enough = needed <= maxMortgage;
  const equityMissing = Math.max(needed - maxMortgage, 0);
  const limitedBy = byIncome < byLtv ? "income" : "ltv";
  return { years, maxMortgage, needed, payment, ptiActual, enough, equityMissing, limitedBy, maxPayment };
}
