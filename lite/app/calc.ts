// חישוב מקוצר, באותם כללים כמו כלי האיפיון המלא: יחס החזר עד 38% מההכנסה
// הפנויה, תקרת מימון לפי סוג הנכס, וטבלת תמהילים ותקופות
// (ריבית ממוצעת: צמוד מדד 3.2%, לא צמוד מדד 4.8%).
import { closingCosts } from "./costs-config";
export type DealType = "first" | "replacement" | "investment";
// ניסוח פנימי (גיליון, מייל, הודעה לצ'יקו)
export const DEAL_LABELS: Record<DealType, string> = {
  first: "דירה יחידה",
  replacement: "דירה חלופית",
  investment: "דירה נוספת",
};
export const LTV: Record<DealType, number> = { first: 0.75, replacement: 0.7, investment: 0.5 };
export const PTI = 0.38;
export const LINKED = 3.2;
export const UNLINKED = 4.8;
// ניסוח ללקוח, בלשון רבים ובשפה יומיומית
export const DEAL_UI_LABELS: Record<DealType, string> = {
  first: "דירה ראשונה ויחידה",
  replacement: "החלפת דירה (עוד לא מכרנו את הנוכחית)",
  investment: "דירה להשקעה",
};
export const TERMS = [15, 20, 25, 30] as const;
export const MIXES = [
  { id: "l100", label: "100% צמוד", linked: 1 },
  { id: "u100", label: "100% לא צמוד", linked: 0 },
  { id: "l33", label: "1/3 צמוד, 2/3 לא צמוד", linked: 1 / 3 },
  { id: "l67", label: "2/3 צמוד, 1/3 לא צמוד", linked: 2 / 3 },
] as const;

export type Input = { income: number; obligations: number; equity: number; deal: DealType };

function pmtFactor(rate: number, years: number) {
  const r = rate / 100 / 12, n = years * 12;
  return (r * 1) / (1 - Math.pow(1 + r, -n));
}
const blended = (linked: number, years: number) =>
  linked * pmtFactor(LINKED, years) + (1 - linked) * pmtFactor(UNLINKED, years);

// מחיר הנכס המרבי, כשההוצאות הנלוות יוצאות מההון העצמי (הבנק לא מממן אותן):
//   משכנתה = מחיר - (הון עצמי - הוצאות)
//   מוגבלת גם ביכולת ההחזר (byIncome) וגם באחוז המימון (ltv * מחיר).
function maxPrice(equity: number, byIncome: number, ltv: number, deal: DealType) {
  const search = (ok: (p: number) => boolean) => {
    let lo = 0, hi = 50_000_000;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid; else hi = mid;
    }
    return lo;
  };
  const byIncomePrice = search((p) => p + closingCosts(p, deal).total <= equity + byIncome);
  const byEquityPrice = search((p) => (1 - ltv) * p + closingCosts(p, deal).total <= equity);
  return { price: Math.min(byIncomePrice, byEquityPrice), limitedBy: byIncomePrice < byEquityPrice ? ("income" as const) : ("equity" as const) };
}

export function calc(i: Input) {
  const disposable = Math.max(i.income - i.obligations, 0);
  const maxPayment = disposable * PTI;
  const ltv = LTV[i.deal];

  const rows = MIXES.map((mix) => ({
    mix,
    cells: TERMS.map((years) => {
      const f = blended(mix.linked, years);
      const { price, limitedBy } = maxPrice(i.equity, maxPayment / f, ltv, i.deal);
      const costs = closingCosts(price, i.deal).total;
      const mortgage = Math.max(price - (i.equity - costs), 0);
      return { years, price, mortgage, payment: mortgage * f, costs, limitedBy, factor: f };
    }),
  }));

  let best = rows[0].cells[0];
  rows.forEach((r) => r.cells.forEach((c) => { if (c.price > best.price) best = c; }));
  const limitedBy = best.limitedBy;
  const breakdown = closingCosts(best.price, i.deal);

  // "מה חסר כדי לקבל יותר": כמה מוסיף הון עצמי נוסף או הכנסה נוספת, באותו תמהיל ותקופה של התוצאה הטובה ביותר.
  const EXTRA_EQUITY = 100_000, EXTRA_INCOME = 1_000;
  const priceWith = (equity: number, income: number) =>
    maxPrice(equity, (Math.max(income - i.obligations, 0) * PTI) / best.factor, ltv, i.deal).price;
  const gainPerExtraEquity = priceWith(i.equity + EXTRA_EQUITY, i.income) - best.price;
  const gainPerExtraIncome = priceWith(i.equity, i.income + EXTRA_INCOME) - best.price;

  return {
    rows, best, maxPayment, ltvPercent: ltv * 100, limitedBy, breakdown,
    extra: { equity: EXTRA_EQUITY, income: EXTRA_INCOME, gainPerExtraEquity, gainPerExtraIncome },
  };
}
