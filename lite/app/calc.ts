// חישוב מקוצר: יחס החזר עד 38% מההכנסה הפנויה, תקרת מימון לפי סוג הנכס,
// ותמהיל ממוצע של ריבית צמודה ולא צמודה, ל-30 שנה.
export type DealType = "first" | "replacement" | "investment";
export const DEAL_LABELS: Record<DealType, string> = {
  first: "דירה יחידה",
  replacement: "דירה חלופית",
  investment: "דירה נוספת",
};
const LTV: Record<DealType, number> = { first: 0.75, replacement: 0.7, investment: 0.5 };
const PTI = 0.38;
const YEARS = 30;
const BLENDED_RATE = 0.34 * 0.028 + 0.66 * 0.045;

export type Input = { income: number; obligations: number; equity: number; deal: DealType };

function factor(years: number) {
  const r = BLENDED_RATE / 12, n = years * 12;
  return (1 - Math.pow(1 + r, -n)) / r;
}

export function calc(i: Input) {
  const disposable = Math.max(i.income - i.obligations, 0);
  const maxPayment = disposable * PTI;
  const byIncome = maxPayment * factor(YEARS);
  const ltv = LTV[i.deal];
  // שווי נכס מקסימלי: מוגבל גם ביכולת ההחזר (הון + משכנתה) וגם באחוז המימון (הון / (1 - מימון)).
  const priceByIncome = i.equity + byIncome;
  const priceByLtv = i.equity / (1 - ltv);
  const maxPrice = Math.min(priceByIncome, priceByLtv);
  const maxMortgage = Math.max(maxPrice - i.equity, 0);
  const payment = maxMortgage / factor(YEARS);
  return {
    maxMortgage, maxPrice, payment, maxPayment, ltvPercent: ltv * 100,
    limitedBy: priceByIncome <= priceByLtv ? "income" : "equity",
  };
}
