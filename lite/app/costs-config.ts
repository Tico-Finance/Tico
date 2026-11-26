// הוצאות נלוות לרכישה. הקובץ היחיד שצריך לעדכן כשהערכים משתנים (מדרגות מס הרכישה משתנות בכל ינואר).
//
// !!! לא אומת מול רשות המסים: המדרגות כאן הן ערכי 2025 (מ-16.1.2025). לפני העלייה לאוויר,
// ובכל ינואר, לבדוק ולעדכן מול אתר רשות המסים (gov.il) ולעדכן את TAX_VALID_FROM.
// גם שיעור המע"מ (18%) טעון אימות.
export const TAX_VALID_FROM = "2025-01-16 (לא אומת ל-2026)";

export const VAT = 0.18;
export const BROKER_PCT = 0.02; // תיווך, לפני מע"מ, מהמחיר
export const LAWYER_PCT = 0.005; // עו"ד, לפני מע"מ, מהמחיר
export const OTHER_FIXED = 12_000; // אגרות רישום, שמאות, פתיחת תיק, ייעוץ משכנתאות. לפני מע"מ

// מדרגות מס רכישה: [תקרת מדרגה, שיעור]
type Bracket = [number, number];
const SINGLE: Bracket[] = [
  [1_978_745, 0],
  [2_347_040, 0.035],
  [6_055_070, 0.05],
  [20_183_565, 0.08],
  [Infinity, 0.1],
];
const ADDITIONAL: Bracket[] = [
  [6_055_070, 0.08],
  [Infinity, 0.1],
];
export const TAX_BRACKETS = {
  first: SINGLE,
  // דירה חלופית: בהנחה שהדירה הנוכחית תימכר בתוך 18 חודשים, ולכן מדרגות דירה יחידה.
  replacement: SINGLE,
  investment: ADDITIONAL,
} as const;

export function purchaseTax(price: number, deal: keyof typeof TAX_BRACKETS) {
  let tax = 0, lo = 0;
  for (const [hi, rate] of TAX_BRACKETS[deal]) {
    if (price > lo) tax += (Math.min(price, hi) - lo) * rate;
    lo = hi;
  }
  return tax;
}

export function closingCosts(price: number, deal: keyof typeof TAX_BRACKETS) {
  const broker = price * BROKER_PCT * (1 + VAT);
  const lawyer = price * LAWYER_PCT * (1 + VAT);
  const other = OTHER_FIXED * (1 + VAT);
  const tax = purchaseTax(price, deal);
  return { broker, lawyer, other, tax, total: broker + lawyer + other + tax };
}
