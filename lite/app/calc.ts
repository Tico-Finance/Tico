// חישוב מקוצר, באותם כללים כמו כלי האיפיון המלא: יחס החזר עד 38% מההכנסה
// הפנויה, תקרת מימון לפי סוג הנכס, וטבלת תמהילים ותקופות
// (ריבית ממוצעת: צמוד מדד 3.2%, לא צמוד מדד 4.8%).
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

export function calc(i: Input) {
  const disposable = Math.max(i.income - i.obligations, 0);
  const maxPayment = disposable * PTI;
  const ltv = LTV[i.deal];
  const priceCapByLtv = i.equity / (1 - ltv);

  const rows = MIXES.map((mix) => ({
    mix,
    cells: TERMS.map((years) => {
      const f = blended(mix.linked, years);
      const byIncome = maxPayment / f;
      const price = Math.min(i.equity + byIncome, priceCapByLtv);
      const mortgage = Math.max(price - i.equity, 0);
      return { years, price, mortgage, payment: mortgage * f };
    }),
  }));

  let best = rows[0].cells[0];
  let bestMix: string = rows[0].mix.label;
  rows.forEach((r) => r.cells.forEach((c) => { if (c.price > best.price) { best = c; bestMix = r.mix.label; } }));
  const limitedBy = best.price >= priceCapByLtv - 1 ? "equity" : "income";

  return { rows, best, bestMix, maxPayment, ltvPercent: ltv * 100, limitedBy };
}
