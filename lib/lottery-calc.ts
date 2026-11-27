// חישובי מחשבון הגרלות הדיור. משותף ללקוח (המחשבון באתר) ולשרת (הדוח ב-PDF),
// כדי שהדוח ייבנה תמיד מחישוב שרת ולא ממספרים שהדפדפן שלח.

export type ApartmentSize = {
  id: number;
  label: string;
  mainSqm: number;
};

export const DEFAULT_SIZES: ApartmentSize[] = [
  { id: 1, label: "3 חדרים", mainSqm: 84 },
  { id: 2, label: "4 חדרים", mainSqm: 100 },
  { id: 3, label: "5 חדרים", mainSqm: 115 },
  { id: 4, label: "6 חדרים", mainSqm: 125 },
];

// הנחות קבועות של המחשבון - לא משתנות בין הגרלות, ולכן לא ניתנות לעריכה.
// גודל המרפסת/המחסן ומספר החניות כן משתנים בין הגרלות ומוזנים על ידי
// המשתמש - רק אופן החישוב שלהם (המכפיל ממחיר המ״ר, מחיר חניה) קבוע.
export const VAT_PERCENT = 18;
export const BALCONY_FACTOR = 0.5;
export const STORAGE_FACTOR = 0.25;
export const PARKING_PRICE = 70000; // ₪ לחניה, כולל מע״מ - נוסף ישירות למחיר הכולל מע״מ

// כללי המימון של מחיר למשתכן (הוראת ניהול בנקאי תקין 329, סעיף 4א):
// אם שווי השוק (המחיר לפני הנחה) עולה על 2.1 מיליון ₪, שווי הנכס לצורך
// המשכנתה הוא הגבוה מבין 2.1 מיליון ₪ לבין מחיר החוזה. המשכנתה עד 75%
// משווי זה, בכפוף למינימום הון עצמי: 60,000 ₪ אם יש מענק מקום, אחרת 100,000 ₪.
export const MORTGAGE_PRICE_CAP = 2_100_000;
export const MORTGAGE_LTV = 0.75;
export const MIN_EQUITY_WITH_GRANT = 60_000;
export const MIN_EQUITY_NO_GRANT = 100_000;

// הערכת החזר חודשי - ריבית ממוצעת לדוגמה, לא הצעה מחייבת מבנק כלשהו.
export const MORTGAGE_INTEREST_RATE_PERCENT = 4.7;
export const MORTGAGE_TERM_YEARS = [20, 25, 30];

export const GRANT_OPTIONS = [
  { value: 0, label: "אין מענק (0 ₪)" },
  { value: 40_000, label: "40,000 ₪" },
  { value: 60_000, label: "60,000 ₪" },
];

export type LotteryInput = {
  pricePerSqm: number;
  discountPercent: number;
  discountCap: number;
  referencePrice: number;
  balconySqm: number;
  storageSqm: number;
  parkingCount: number;
  grant: number;
  sizes: ApartmentSize[];
};

export type LotteryRow = {
  size: ApartmentSize;
  calcSqm: number;
  preDiscountIncVat: number;
  discount: number;
  boundBy: string;
  finalIncVat: number;
  contractPrice: number;
  equity: number;
  mortgage: number;
  monthlyPayments: Record<number, number>;
};

export function calculateEquityAndMortgage(
  contractPrice: number,
  marketValue: number,
  grant: number
) {
  const minEquity = grant > 0 ? MIN_EQUITY_WITH_GRANT : MIN_EQUITY_NO_GRANT;
  const recognizedValue =
    marketValue > MORTGAGE_PRICE_CAP
      ? Math.max(MORTGAGE_PRICE_CAP, contractPrice)
      : marketValue;
  const mortgage = Math.max(
    Math.min(MORTGAGE_LTV * recognizedValue, contractPrice - minEquity),
    0
  );
  return { mortgage, equity: contractPrice - mortgage };
}

export function calculateMonthlyPayment(principal: number, years: number) {
  const monthlyRate = MORTGAGE_INTEREST_RATE_PERCENT / 100 / 12;
  const numPayments = years * 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
}

export function calculateLottery(input: LotteryInput): LotteryRow[] {
  const {
    sizes,
    pricePerSqm,
    discountPercent,
    discountCap,
    referencePrice,
    balconySqm,
    storageSqm,
    parkingCount,
    grant,
  } = input;

  const parkingCost = PARKING_PRICE * parkingCount;
  const balconySqmEquivalent = balconySqm * BALCONY_FACTOR;
  const storageSqmEquivalent = storageSqm * STORAGE_FACTOR;

  return sizes.map((size) => {
    const calcSqm = size.mainSqm + balconySqmEquivalent + storageSqmEquivalent;

    const preDiscountExVat = calcSqm * pricePerSqm;
    const preDiscountIncVat = preDiscountExVat * (1 + VAT_PERCENT / 100);

    const trackA = (discountPercent / 100) * preDiscountIncVat;
    const trackB = discountCap;
    const discount = Math.min(trackA, trackB, preDiscountIncVat);
    const boundBy = trackA <= trackB ? "א׳ (אחוז)" : "ב׳ (תקרה)";

    const finalIncVat = preDiscountIncVat - discount;
    const contractPrice = finalIncVat + parkingCost;

    const marketValue =
      referencePrice > 0
        ? referencePrice * calcSqm * (1 + VAT_PERCENT / 100)
        : preDiscountIncVat;

    const { mortgage, equity } = calculateEquityAndMortgage(
      contractPrice,
      marketValue,
      grant
    );
    const monthlyPayments = Object.fromEntries(
      MORTGAGE_TERM_YEARS.map((years) => [
        years,
        calculateMonthlyPayment(mortgage, years),
      ])
    ) as Record<number, number>;

    return {
      size,
      calcSqm,
      preDiscountIncVat,
      discount,
      boundBy,
      finalIncVat,
      contractPrice,
      equity,
      mortgage,
      monthlyPayments,
    };
  });
}
