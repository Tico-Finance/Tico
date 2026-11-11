"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { downloadExcel } from "./export";

type EmploymentType = "employee" | "self-employed" | "other";
type CreditConduct = "good" | "notes" | "restricted";

type Borrower = {
  name: string;
  age: number;
  profession: string;
  employmentType: EmploymentType;
  netIncome: number;
  obligations: number;
  additionalIncome: number;
  creditConduct: CreditConduct;
};

const EMPTY_BORROWER: Borrower = {
  name: "",
  age: 35,
  profession: "",
  employmentType: "employee",
  netIncome: 0,
  obligations: 0,
  additionalIncome: 0,
  creditConduct: "good",
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  employee: "שכיר",
  "self-employed": "עצמאי",
  other: "אחר",
};

const CREDIT_CONDUCT_LABELS: Record<CreditConduct, string> = {
  good: "תקינה",
  notes: "יש הערות בדוח נתוני אשראי",
  restricted: "קיימות הגבלות / עיכולים",
};

type TransactionType = {
  id: string;
  label: string;
  ltv: number;
  note: string;
};

const TRANSACTION_TYPES: TransactionType[] = [
  {
    id: "single",
    label: "דירה יחידה / דירה ראשונה",
    ltv: 0.75,
    note: "מימון של עד 75% משווי הנכס.",
  },
  {
    id: "replacement",
    label: "דירה חלופית (משפרי דיור שטרם מכרו את הדירה הקיימת)",
    ltv: 0.7,
    note: "מימון של עד 70% משווי הנכס.",
  },
  {
    id: "investment",
    label: "דירה נוספת / להשקעה",
    ltv: 0.5,
    note: "מימון של עד 50% משווי הנכס.",
  },
];

// כללי המימון וההחזר:
// (1) אחוז המימון המקסימלי (LTV) תלוי בסוג העסקה - ר' TRANSACTION_TYPES.
// (2) הכנסה פנויה = הכנסה נטו פחות התחייבויות קיימות (אם יש).
// (3) יחס החזר - תקרה קבועה יחידה: עד 38% מההכנסה הפנויה. זו התקרה
//     היחידה שלפיה מחושבת יכולת המימון (בכפוף גם לתקרת ה-LTV).
const WORKING_PTI_CAP_PERCENT = 38;

// יכולת המימון מחושבת לפי תמהיל בין שני מסלולי ריבית ממוצעים - צמוד
// מדד ולא צמוד מדד - ולפי תקופות הלוואה סטנדרטיות.
const LINKED_RATE_PERCENT = 2.8;
const UNLINKED_RATE_PERCENT = 4.5;
const TERM_OPTIONS_YEARS = [15, 20, 25, 30] as const;

type MixOption = {
  id: string;
  label: string;
  linkedShare: number;
};

const MIX_OPTIONS: MixOption[] = [
  { id: "linked-100", label: "100% צמוד מדד", linkedShare: 1 },
  { id: "unlinked-100", label: "100% לא צמוד מדד", linkedShare: 0 },
  {
    id: "linked-34",
    label: "34% צמוד מדד + 66% לא צמוד מדד",
    linkedShare: 0.34,
  },
  {
    id: "linked-66",
    label: "34% לא צמוד מדד + 66% צמוד מדד",
    linkedShare: 0.66,
  },
];

// כללי המימון של מחיר למשתכן (הוראת ניהול בנקאי תקין 329, סעיף 4א) -
// זהה לחישוב במחשבון ההגרלות (lottery-calculator): אם שווי השוק (המחיר
// לפני הנחה) עולה על 2.1 מיליון ₪, שווי הנכס לצורך המשכנתה הוא הגבוה
// מבין 2.1 מיליון ₪ לבין מחיר החוזה. המשכנתה עד 75% משווי זה, ולא
// יותר ממחיר החוזה בניכוי מינימום הון עצמי (תלוי במענק מקום).
const MECHIR_PRICE_CAP = 2_100_000;
const MECHIR_LTV = 0.75;
const MECHIR_MIN_EQUITY_WITH_GRANT = 60_000;
const MECHIR_MIN_EQUITY_NO_GRANT = 100_000;
const MECHIR_GRANT_OPTIONS = [
  { value: 0, label: "אין מענק (0 ₪)" },
  { value: 40_000, label: "40,000 ₪" },
  { value: 60_000, label: "60,000 ₪" },
];

const DEFAULT_RECOGNITION_PERCENT = 70;
const MIN_TERM_YEARS = 4;
const MAX_TERM_YEARS = 30;
const RETIREMENT_AGE_CAP = 75;

const currency = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});

function numberInputValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatDate(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ההחזר החודשי (שיטת שפיצר) עבור קרן נתונה.
function monthlyPaymentForPrincipal(
  principal: number,
  annualRatePercent: number,
  years: number
) {
  if (principal <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return principal / numPayments;
  return (
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments))
  );
}

// ההחזר החודשי הממוצע-משוקלל עבור כל שקל קרן, לפי תמהיל בין מסלול
// צמוד מדד (LINKED_RATE_PERCENT) למסלול לא צמוד מדד (UNLINKED_RATE_PERCENT).
function blendedPaymentFactor(linkedShare: number, years: number) {
  const linkedFactor = monthlyPaymentForPrincipal(1, LINKED_RATE_PERCENT, years);
  const unlinkedFactor = monthlyPaymentForPrincipal(
    1,
    UNLINKED_RATE_PERCENT,
    years
  );
  return linkedShare * linkedFactor + (1 - linkedShare) * unlinkedFactor;
}

function principalForBlendedPayment(
  payment: number,
  linkedShare: number,
  years: number
) {
  const factor = blendedPaymentFactor(linkedShare, years);
  return factor > 0 ? payment / factor : 0;
}

function paymentForBlendedPrincipal(
  principal: number,
  linkedShare: number,
  years: number
) {
  return principal * blendedPaymentFactor(linkedShare, years);
}

function ptiStatus(percent: number) {
  if (percent <= WORKING_PTI_CAP_PERCENT) {
    return {
      label: `בתוך תקרת ההחזר (${WORKING_PTI_CAP_PERCENT}%)`,
      className: "text-[var(--tico-good)]",
    };
  }
  return {
    label: `חורג מתקרת ההחזר (${WORKING_PTI_CAP_PERCENT}%) - לא עומד ביכולת`,
    className: "text-[var(--tico-critical)]",
  };
}

export default function SmartMortgageCalculator() {
  const [borrowers, setBorrowers] = useState<[Borrower, Borrower]>([
    { ...EMPTY_BORROWER },
    { ...EMPTY_BORROWER },
  ]);
  const [hasSecondBorrower, setHasSecondBorrower] = useState(false);
  const [recognitionPercent, setRecognitionPercent] = useState<number>(
    DEFAULT_RECOGNITION_PERCENT
  );

  // פרטי הנכס
  const [transactionTypeId, setTransactionTypeId] = useState(
    TRANSACTION_TYPES[0].id
  );
  const [hasExistingProperty, setHasExistingProperty] = useState(false);
  const [existingPropertyValue, setExistingPropertyValue] = useState<number>(0);
  const [existingMortgageBalance, setExistingMortgageBalance] =
    useState<number>(0);
  const [existingPropertyLocation, setExistingPropertyLocation] =
    useState("");
  const [propertyValue, setPropertyValue] = useState<number>(0);
  const [isMechirLamishtaken, setIsMechirLamishtaken] = useState(false);
  const [mechirMarketValue, setMechirMarketValue] = useState<number>(0);
  const [mechirDiscountPercent, setMechirDiscountPercent] =
    useState<number>(25);
  const [mechirDiscountCap, setMechirDiscountCap] = useState<number>(500_000);
  const [mechirGrant, setMechirGrant] = useState<number>(0);
  const [newPropertyLocation, setNewPropertyLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [propertyRegistration, setPropertyRegistration] = useState("");
  const [liquidEquity, setLiquidEquity] = useState<number>(0);
  const [useManualFinancingPercent, setUseManualFinancingPercent] =
    useState(false);
  const [manualFinancingPercent, setManualFinancingPercent] =
    useState<number>(70);

  // הוצאות נלוות
  const [lawyerFee, setLawyerFee] = useState<number>(0);
  const [brokerFee, setBrokerFee] = useState<number>(0);
  const [purchaseTax, setPurchaseTax] = useState<number>(0);
  const [mortgageAdvisoryFee, setMortgageAdvisoryFee] = useState<number>(0);
  const [otherFees, setOtherFees] = useState<number>(0);

  const [notes, setNotes] = useState("");

  function updateBorrower(index: 0 | 1, patch: Partial<Borrower>) {
    setBorrowers((prev) => {
      const next = [...prev] as [Borrower, Borrower];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  const transactionType =
    TRANSACTION_TYPES.find((type) => type.id === transactionTypeId) ??
    TRANSACTION_TYPES[0];

  // עסקת מחיר למשתכן: מחיר החוזה בפועל = שווי השוק בניכוי ההנחה (הנמוך
  // מבין אחוז ותקרה, כמו במחשבון ההגרלות) - וזה שווי הנכס האפקטיבי
  // שמשמש לכל שאר החישובים (הון עצמי, הוצאות נלוות וכו').
  const mechirDiscount = isMechirLamishtaken
    ? Math.min(
        (mechirDiscountPercent / 100) * mechirMarketValue,
        mechirDiscountCap,
        mechirMarketValue
      )
    : 0;
  const mechirContractPrice = isMechirLamishtaken
    ? Math.max(mechirMarketValue - mechirDiscount, 0)
    : 0;
  const effectivePropertyValue = isMechirLamishtaken
    ? mechirContractPrice
    : propertyValue;

  const activeBorrowersForAge = hasSecondBorrower ? borrowers : [borrowers[0]];
  const oldestBorrowerAge = Math.max(
    ...activeBorrowersForAge.map((b) => b.age)
  );
  const recommendedMaxTerm = clamp(
    RETIREMENT_AGE_CAP - oldestBorrowerAge,
    MIN_TERM_YEARS,
    MAX_TERM_YEARS
  );

  const results = useMemo(() => {
    const active = hasSecondBorrower ? borrowers : [borrowers[0]];
    const totalIncome = active.reduce(
      (sum, b) =>
        sum + b.netIncome + b.additionalIncome * (recognitionPercent / 100),
      0
    );
    const totalObligations = active.reduce(
      (sum, b) => sum + b.obligations,
      0
    );
    const disposableIncomeBeforeMortgage = totalIncome - totalObligations;

    const netEquityFromSale = hasExistingProperty
      ? Math.max(existingPropertyValue - existingMortgageBalance, 0)
      : 0;
    const totalAvailableEquity = liquidEquity + netEquityFromSale;

    // מחיר למשתכן: תקרת המימון לפי שווי הייחוס (הגבוה מבין 2.1 מיליון
    // ₪ למחיר החוזה, כשהשוק עולה על 2.1 מיליון) - ולא יותר ממחיר החוזה
    // בניכוי מינימום הון עצמי (תלוי במענק מקום). זהה למחשבון ההגרלות.
    const mechirMinEquity =
      mechirGrant > 0 ? MECHIR_MIN_EQUITY_WITH_GRANT : MECHIR_MIN_EQUITY_NO_GRANT;
    const mechirRecognizedValue =
      mechirMarketValue > MECHIR_PRICE_CAP
        ? Math.max(MECHIR_PRICE_CAP, mechirContractPrice)
        : mechirMarketValue;
    const mechirLtvCapAmount = isMechirLamishtaken
      ? Math.max(
          Math.min(
            MECHIR_LTV * mechirRecognizedValue,
            mechirContractPrice - mechirMinEquity
          ),
          0
        )
      : 0;

    const totalAssociatedCosts =
      lawyerFee + brokerFee + purchaseTax + mortgageAdvisoryFee + otherFees;

    const ltvCapAmount = isMechirLamishtaken
      ? mechirLtvCapAmount
      : effectivePropertyValue > 0
        ? effectivePropertyValue * transactionType.ltv
        : Infinity;

    // הכנסה פנויה * 38% - מדיניות העבודה (סעיף 2).
    const maxPaymentAtWorkingCap = Math.max(
      disposableIncomeBeforeMortgage * (WORKING_PTI_CAP_PERCENT / 100),
      0
    );

    // טבלת יכולת מימון: לכל תמהיל ריבית ולכל תקופת הלוואה, יכולת ההחזר
    // הגולמית לפי ההכנסה בלבד (מדיניות עבודה של 38% מההכנסה הפנויה) -
    // ללא הגבלת LTV, כדי שההשוואה בין תמהילים ותקופות תהיה אמיתית ולא
    // "שטוחה" בגלל תקרת המימון של נכס ספציפי (המוצגת בנפרד למטה). ליד
    // כל סכום מוצג גם ההחזר החודשי שמניב אותו (זהה בכל התאים - זו
    // בדיוק אותה תקרת החזר קבועה - אבל מוצג בכל תא כדי שיהיה ברור
    // איזה החזר חודשי עומד מאחורי כל סכום משכנתה).
    const capacityTable = MIX_OPTIONS.map((option) => ({
      mix: option,
      byTerm: TERM_OPTIONS_YEARS.map((years) => {
        const amount = Math.max(
          principalForBlendedPayment(maxPaymentAtWorkingCap, option.linkedShare, years),
          0
        );
        return { amount, payment: maxPaymentAtWorkingCap };
      }),
    }));

    // המשכנתה המקסימלית האפשרית = השילוב הטוב ביותר מתוך כל 16
    // האפשרויות בטבלת יכולת המימון (לא רק התמהיל/התקופה שנבחרו בטופס
    // למטה) - בכפוף לתקרת ה-LTV/מחיר למשתכן.
    let bestCapacityMix = MIX_OPTIONS[0];
    let bestCapacityTermYears: number = TERM_OPTIONS_YEARS[0];
    let bestCapacityAmount = 0;
    capacityTable.forEach((row) => {
      row.byTerm.forEach((cell, index) => {
        if (cell.amount > bestCapacityAmount) {
          bestCapacityAmount = cell.amount;
          bestCapacityMix = row.mix;
          bestCapacityTermYears = TERM_OPTIONS_YEARS[index];
        }
      });
    });
    const recommendedMortgage = Math.max(
      Math.min(ltvCapAmount, bestCapacityAmount),
      0
    );

    // משכנתה נדרשת: באחוז ידני - לפי מה שהמשתמש הגדיר (יכול לחרוג מיכולת
    // ואז יוצג חסר מימון). ללא אחוז ידני - לפי המשכנתה המומלצת שכבר
    // מגבילה גם לפי LTV וגם לפי יכולת הכנסה.
    const requiredMortgage = useManualFinancingPercent
      ? effectivePropertyValue * (manualFinancingPercent / 100)
      : recommendedMortgage;
    const requiredFinancingPercent = effectivePropertyValue > 0
      ? (requiredMortgage / effectivePropertyValue) * 100
      : 0;

    const fundingShortfall = Math.max(
      requiredMortgage - recommendedMortgage,
      0
    );
    const grantedMortgage = Math.min(requiredMortgage, recommendedMortgage);
    // ההון העצמי צריך לכסות גם את פער המימון וגם את ההוצאות הנלוות -
    // הבנק לא מממן הוצאות נלוות. בדיקת התאמה נפרדת מגובה המשכנתה.
    const totalCashNeededAtClosing =
      effectivePropertyValue - grantedMortgage + totalAssociatedCosts;
    const equityShortfall = Math.max(
      totalCashNeededAtClosing - totalAvailableEquity,
      0
    );
    const equitySurplus = Math.max(
      totalAvailableEquity - totalCashNeededAtClosing,
      0
    );

    // טבלת החזר חודשי למשכנתה הנדרשת: לכל תמהיל ותקופה, ההחזר החודשי
    // עבור סכום המשכנתה הנדרשת הקבוע (להבדיל מטבלת יכולת המימון, שבה
    // ההחזר קבוע והסכום משתנה). מציגה את כל האפשרויות בלי לבחור עבור
    // המשתמש תמהיל/תקופה ברירת מחדל.
    const requiredPaymentTable = MIX_OPTIONS.map((option) => ({
      mix: option,
      byTerm: TERM_OPTIONS_YEARS.map((years) =>
        paymentForBlendedPrincipal(requiredMortgage, option.linkedShare, years)
      ),
    }));
    const minMonthlyPayment = Math.min(
      ...requiredPaymentTable.flatMap((row) => row.byTerm)
    );
    const desiredMonthlyPayment = paymentForBlendedPrincipal(
      recommendedMortgage,
      bestCapacityMix.linkedShare,
      bestCapacityTermYears
    );

    const actualPtiPercent =
      disposableIncomeBeforeMortgage > 0
        ? (desiredMonthlyPayment / disposableIncomeBeforeMortgage) * 100
        : 0;
    const disposableIncomeAfterMortgage =
      disposableIncomeBeforeMortgage - desiredMonthlyPayment;

    return {
      totalIncome,
      totalObligations,
      disposableIncomeBeforeMortgage,
      netEquityFromSale,
      totalAvailableEquity,
      requiredMortgage,
      requiredFinancingPercent,
      totalAssociatedCosts,
      ltvCapAmount,
      recommendedMortgage,
      bestCapacityMixLabel: bestCapacityMix.label,
      bestCapacityTermYears,
      capacityTable,
      requiredPaymentTable,
      fundingShortfall,
      totalCashNeededAtClosing,
      equityShortfall,
      equitySurplus,
      minMonthlyPayment,
      desiredMonthlyPayment,
      actualPtiPercent,
      disposableIncomeAfterMortgage,
    };
  }, [
    borrowers,
    hasSecondBorrower,
    recognitionPercent,
    hasExistingProperty,
    existingPropertyValue,
    existingMortgageBalance,
    liquidEquity,
    useManualFinancingPercent,
    manualFinancingPercent,
    effectivePropertyValue,
    isMechirLamishtaken,
    mechirMarketValue,
    mechirContractPrice,
    mechirGrant,
    lawyerFee,
    brokerFee,
    purchaseTax,
    mortgageAdvisoryFee,
    otherFees,
    transactionType,
  ]);

  const status = ptiStatus(results.actualPtiPercent);
  const hasEnoughData = effectivePropertyValue > 0 && results.totalIncome > 0;

  function handlePrintPdf() {
    window.print();
  }

  function handleExportExcel() {
    const active = hasSecondBorrower ? borrowers : [borrowers[0]];
    const now = new Date();
    const dateLabel = now.toLocaleDateString("he-IL");
    // שם קובץ באנגלית בלבד - תווים בעברית ב-download attribute לא
    // נתמכים באופן עקבי בדפדפנים ומובילים לשם קובץ גנרי ללא סיומת.
    const fileDate = now.toISOString().slice(0, 10);

    downloadExcel(`mortgage-calculator-${fileDate}.xlsx`, [
      {
        name: "סיכום",
        rows: [
          ["תאריך", dateLabel],
          ["סוג עסקה", isMechirLamishtaken ? "מחיר למשתכן" : transactionType.label],
          ["שווי נכס נרכש (₪)", effectivePropertyValue],
          ...(isMechirLamishtaken
            ? ([
                ["שווי שוק (לפני הנחה) (₪)", mechirMarketValue],
                ["הנחה (₪)", Math.round(mechirDiscount)],
                ["מחיר חוזה (₪)", Math.round(mechirContractPrice)],
                ["מענק מקום (₪)", mechirGrant],
              ] as (string | number)[][])
            : []),
          ["הון עצמי זמין (₪)", results.totalAvailableEquity],
          ["סה״כ הכנסה (₪)", results.totalIncome],
          ["סה״כ התחייבויות (₪)", results.totalObligations],
          ["הכנסה פנויה (₪)", results.disposableIncomeBeforeMortgage],
          ["יחס החזר בפועל (%)", Number(results.actualPtiPercent.toFixed(1))],
          ["משכנתה נדרשת לעסקה (₪)", results.requiredMortgage],
          ["אחוז מימון נדרש (%)", Number(results.requiredFinancingPercent.toFixed(1))],
          ["משכנתה מקסימלית אפשרית (₪)", results.recommendedMortgage],
          ["תמהיל ותקופה למשכנתה המקסימלית", `${results.bestCapacityMixLabel}, ${results.bestCapacityTermYears} שנה`],
          ["החזר חודשי מינימלי - הזול מכל האפשרויות (₪)", Math.round(results.minMonthlyPayment)],
          ["החזר חודשי רצוי - למשכנתה המקסימלית (₪)", Math.round(results.desiredMonthlyPayment)],
          ["סה״כ הוצאות נלוות (₪)", results.totalAssociatedCosts],
          ["סה״כ מזומן נדרש בסגירת העסקה (₪)", Math.round(results.totalCashNeededAtClosing)],
          [
            "התאמת הון עצמי",
            results.equityShortfall > 0
              ? `חסר ${Math.round(results.equityShortfall)} ₪`
              : `עודף ${Math.round(results.equitySurplus)} ₪`,
          ],
          [
            "הכנסה פנויה אחרי ההחזר הרצוי (₪)",
            Math.round(results.disposableIncomeAfterMortgage),
          ],
        ],
      },
      {
        name: "יכולת מימון",
        rows: [
          ["תמהיל", "15 שנה", "20 שנה", "25 שנה", "30 שנה"],
          ...results.capacityTable.map((row) => [
            row.mix.label,
            ...row.byTerm.map((cell) => Math.round(cell.amount)),
          ]),
          [],
          [
            "הערה",
            `כל הסכומים בטבלה מבוססים על החזר חודשי קבוע של ${Math.round(results.capacityTable[0]?.byTerm[0]?.payment ?? 0)} ₪ (יחס החזר ${WORKING_PTI_CAP_PERCENT}% מההכנסה הפנויה) - זה ההחזר החודשי שיתאים לכל אחד מהסכומים שלמעלה`,
          ],
        ],
      },
      {
        name: "החזר למשכנתה הנדרשת",
        rows: [
          ["תמהיל", "15 שנה", "20 שנה", "25 שנה", "30 שנה"],
          ...results.requiredPaymentTable.map((row) => [
            row.mix.label,
            ...row.byTerm.map((payment) => Math.round(payment)),
          ]),
          [],
          [
            "הערה",
            `ההחזר החודשי (₪) עבור המשכנתה הנדרשת הקבועה (${Math.round(results.requiredMortgage)} ₪) לפי כל תמהיל ותקופה`,
          ],
        ],
      },
      {
        name: "פרטי לווים",
        rows: [
          [
            "לווה",
            "שם",
            "גיל",
            "מקצוע",
            "סוג עיסוק",
            "הכנסה נטו (₪)",
            "התחייבויות (₪)",
            "הכנסות נוספות (₪)",
            "התנהלות אשראית",
          ],
          ...active.map((borrower, index) => [
            `לווה ${index + 1}`,
            borrower.name,
            borrower.age,
            borrower.profession,
            EMPLOYMENT_TYPE_LABELS[borrower.employmentType],
            borrower.netIncome,
            borrower.obligations,
            borrower.additionalIncome,
            CREDIT_CONDUCT_LABELS[borrower.creditConduct],
          ]),
        ],
      },
    ]);
  }

  return (
    <>
    <div className="flex flex-col gap-6 print:hidden">
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <div>
          <h2 className="text-lg font-semibold text-foreground">פרטי לווים</h2>
          <p className="text-xs text-foreground/50">
            הפרטים משמשים לחישוב בלבד ואינם נשמרים במערכת.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <BorrowerCard
            title="לווה 1"
            borrower={borrowers[0]}
            onChange={(patch) => updateBorrower(0, patch)}
          />
          {hasSecondBorrower ? (
            <BorrowerCard
              title="לווה 2"
              borrower={borrowers[1]}
              onChange={(patch) => updateBorrower(1, patch)}
            />
          ) : (
            <div className="flex items-start">
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={hasSecondBorrower}
                  onChange={(e) => setHasSecondBorrower(e.target.checked)}
                  className="h-4 w-4"
                />
                יש לווה נוסף
              </label>
            </div>
          )}
        </div>
        {hasSecondBorrower && (
          <button
            type="button"
            onClick={() => setHasSecondBorrower(false)}
            className="self-start text-xs text-foreground/50 underline hover:text-primary"
          >
            הסרת לווה נוסף
          </button>
        )}
        <Field label="אחוז הכרה בהכנסות הנוספות" suffix="%">
          <NumberInput
            value={recognitionPercent}
            onChange={setRecognitionPercent}
            min={0}
            max={100}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <h2 className="text-lg font-semibold text-foreground">פרטי הנכס</h2>

        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={isMechirLamishtaken}
            onChange={(e) => setIsMechirLamishtaken(e.target.checked)}
            className="h-4 w-4"
          />
          עסקת מחיר למשתכן
        </label>

        {isMechirLamishtaken ? (
          <div className="flex flex-col gap-4 rounded-xl bg-background p-4">
            <p className="text-xs text-foreground/50">
              משכנתה עד {Math.round(MECHIR_LTV * 100)}% משווי הייחוס - הגבוה
              מבין {currency.format(MECHIR_PRICE_CAP)} ₪ למחיר החוזה, אם
              שווי השוק (המחיר לפני הנחה) עולה על {currency.format(MECHIR_PRICE_CAP)}{" "}
              ₪ - ולא יותר ממחיר החוזה בניכוי מינימום הון עצמי (הוראת ניהול
              בנקאי תקין 329, סעיף 4א).
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="שווי שוק (מחיר לפני הנחה)" suffix="₪">
                <NumberInput
                  value={mechirMarketValue}
                  onChange={setMechirMarketValue}
                  min={0}
                />
              </Field>
              <Field label="אחוז הנחה" suffix="%">
                <NumberInput
                  value={mechirDiscountPercent}
                  onChange={setMechirDiscountPercent}
                  min={0}
                  max={100}
                />
              </Field>
              <Field label="תקרת הנחה מקסימלית" suffix="₪">
                <NumberInput
                  value={mechirDiscountCap}
                  onChange={setMechirDiscountCap}
                  min={0}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground/80">
                מענק מקום
              </span>
              <div className="flex flex-wrap gap-4">
                {MECHIR_GRANT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 text-sm text-foreground/80"
                  >
                    <input
                      type="radio"
                      name="mechirGrant"
                      checked={mechirGrant === option.value}
                      onChange={() => setMechirGrant(option.value)}
                      className="h-4 w-4"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResultCard label="הנחה בפועל" value={mechirDiscount} />
              <ResultCard
                label="מחיר חוזה (שווי הנכס בפועל)"
                value={mechirContractPrice}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground/80">
              סיווג לצורך אחוז מימון מקסימלי (LTV)
            </span>
            {TRANSACTION_TYPES.map((type) => (
              <label
                key={type.id}
                className="flex items-center gap-2 text-sm text-foreground/80"
              >
                <input
                  type="radio"
                  name="transactionType"
                  checked={transactionTypeId === type.id}
                  onChange={() => setTransactionTypeId(type.id)}
                  className="h-4 w-4"
                />
                <span>
                  {type.label}{" "}
                  <span className="text-foreground/50">({type.note})</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={hasExistingProperty}
            onChange={(e) => setHasExistingProperty(e.target.checked)}
            className="h-4 w-4"
          />
          יש נכס קיים למכירה (משפרי דיור)
        </label>
        {hasExistingProperty && (
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-background p-4 sm:grid-cols-3">
            <Field label="שווי נכס קיים" suffix="₪">
              <NumberInput
                value={existingPropertyValue}
                onChange={setExistingPropertyValue}
                min={0}
              />
            </Field>
            <Field label="משכנתה קיימת (יתרה)" suffix="₪">
              <NumberInput
                value={existingMortgageBalance}
                onChange={setExistingMortgageBalance}
                min={0}
              />
            </Field>
            <Field label="מיקום הנכס הקיים">
              <TextInput
                value={existingPropertyLocation}
                onChange={setExistingPropertyLocation}
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isMechirLamishtaken && (
            <Field label="שווי נכס נרכש / מחיר רכישה" suffix="₪">
              <NumberInput
                value={propertyValue}
                onChange={setPropertyValue}
                min={0}
              />
            </Field>
          )}
          <Field label="מיקום הנכס הנרכש">
            <TextInput
              value={newPropertyLocation}
              onChange={setNewPropertyLocation}
            />
          </Field>
          <Field label="סוג הנכס">
            <TextInput
              value={propertyType}
              onChange={setPropertyType}
              placeholder="דירה / בית פרטי / מסחרי"
            />
          </Field>
          <Field label="רישום הנכס">
            <TextInput
              value={propertyRegistration}
              onChange={setPropertyRegistration}
              placeholder="טאבו / מנהל / חכירה"
            />
          </Field>
          <Field label="הון עצמי נזיל (חסכונות)" suffix="₪">
            <NumberInput
              value={liquidEquity}
              onChange={setLiquidEquity}
              min={0}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={useManualFinancingPercent}
            onChange={(e) => setUseManualFinancingPercent(e.target.checked)}
            className="h-4 w-4"
          />
          הגדרת אחוז מימון נדרש באופן ידני (במקום חישוב לפי הון עצמי)
        </label>
        {useManualFinancingPercent && (
          <Field label="אחוז מימון נדרש" suffix="%">
            <NumberInput
              value={manualFinancingPercent}
              onChange={setManualFinancingPercent}
              min={0}
              max={100}
              step={1}
            />
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <h2 className="text-lg font-semibold text-foreground">הוצאות נלוות</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="עו״ד" suffix="₪">
            <NumberInput value={lawyerFee} onChange={setLawyerFee} min={0} />
          </Field>
          <Field label="מתווך" suffix="₪">
            <NumberInput value={brokerFee} onChange={setBrokerFee} min={0} />
          </Field>
          <Field label="מס רכישה" suffix="₪">
            <NumberInput
              value={purchaseTax}
              onChange={setPurchaseTax}
              min={0}
            />
          </Field>
          <Field label="ייעוץ משכנתאות" suffix="₪">
            <NumberInput
              value={mortgageAdvisoryFee}
              onChange={setMortgageAdvisoryFee}
              min={0}
            />
          </Field>
          <Field label="אחר" suffix="₪">
            <NumberInput value={otherFees} onChange={setOtherFees} min={0} />
          </Field>
          <ResultCard
            label="סה״כ הוצאות נלוות"
            value={results.totalAssociatedCosts}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <h2 className="text-lg font-semibold text-foreground">פרטי המשכנתה</h2>
        <p className="text-xs text-foreground/50">
          ריביות ממוצעות לחישוב: {LINKED_RATE_PERCENT}% במסלול צמוד מדד,{" "}
          {UNLINKED_RATE_PERCENT}% במסלול לא צמוד מדד - אינן הצעה מחייבת
          מבנק כלשהו. הטבלאות למטה מציגות את כל התמהילים והתקופות יחד,
          ללא בחירה או ברירת מחדל.
        </p>
        <p className="text-xs text-foreground/50">
          לפי הגיל שהוזן, משך ההלוואה המומלץ עד גיל {RETIREMENT_AGE_CAP} הוא{" "}
          {recommendedMaxTerm} שנים.
        </p>
        <p className="text-xs text-foreground/50">
          יחס החזר - תקרה קבועה של עד {WORKING_PTI_CAP_PERCENT}% מההכנסה
          הפנויה.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <h2 className="text-lg font-semibold text-foreground">תוצאות ותמהיל</h2>
        {!hasEnoughData ? (
          <p className="text-sm text-foreground/60">
            הזינו שווי נכס והכנסות כדי לראות תוצאות.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResultCard label="סה״כ הכנסה" value={results.totalIncome} />
              <ResultCard
                label="סה״כ התחייבויות"
                value={results.totalObligations}
              />
              <ResultCard
                label="הכנסה פנויה"
                value={results.disposableIncomeBeforeMortgage}
              />
              <div className="flex flex-col gap-1 rounded-xl bg-background px-4 py-3">
                <span className="text-xs text-foreground/50">יחס החזר</span>
                <span className={`text-lg font-semibold ${status.className}`}>
                  {results.actualPtiPercent.toFixed(1)}%
                </span>
                <span className={`text-xs ${status.className}`}>
                  {status.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResultCard
                label="החזר חודשי מינימלי (הזול מכל האפשרויות, למשכנתה הנדרשת)"
                value={results.minMonthlyPayment}
              />
              <ResultCard
                label={`החזר חודשי רצוי (לתקרת יכולת המימון - תמהיל ${results.bestCapacityMixLabel}, ${results.bestCapacityTermYears} שנה)`}
                value={results.desiredMonthlyPayment}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--tico-line-strong)] text-right text-foreground/70">
                    <th className="py-2 pr-2">משכנתה</th>
                    <th className="py-2">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--tico-line)]">
                    <td className="py-2 pr-2">
                      {useManualFinancingPercent
                        ? "נדרשת לעסקה (לפי אחוז מימון ידני)"
                        : isMechirLamishtaken
                          ? "נדרשת לעסקה (לפי כללי מחיר למשתכן)"
                          : `נדרשת לעסקה (לפי תקרת מימון LTV של ${transactionType.label})`}
                    </td>
                    <td className="py-2">
                      {currency.format(results.requiredMortgage)} ₪ (
                      {results.requiredFinancingPercent.toFixed(0)}% מימון)
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--tico-line)]">
                    <td className="py-2 pr-2">
                      {isMechirLamishtaken
                        ? `מקסימלית אפשרית (יחס החזר ${WORKING_PTI_CAP_PERCENT}%, מחיר למשתכן, השילוב המיטבי: ${results.bestCapacityMixLabel}, ${results.bestCapacityTermYears} שנה)`
                        : `מקסימלית אפשרית (יחס החזר ${WORKING_PTI_CAP_PERCENT}%, ${transactionType.label} - תקרת LTV ${Math.round(transactionType.ltv * 100)}%, השילוב המיטבי: ${results.bestCapacityMixLabel}, ${results.bestCapacityTermYears} שנה)`}
                    </td>
                    <td className="py-2 font-semibold text-foreground">
                      {currency.format(results.recommendedMortgage)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {results.fundingShortfall > 0 ? (
              <div className="rounded-xl bg-[var(--tico-critical-soft)] px-4 py-3 text-sm text-[var(--tico-critical)]">
                ⚠️ חסר מימון של {currency.format(results.fundingShortfall)} ₪
                - המשכנתה הנדרשת חורגת מהתקרה המקסימלית האפשרית. נדרש הון עצמי
                נוסף, הפחתת שווי הנכס, או הארכת תקופת ההלוואה.
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--tico-good-soft)] px-4 py-3 text-sm text-[var(--tico-good)]">
                ✅ הסכום הנדרש לעסקה מכוסה במסגרת תקרת המימון המקסימלית.
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground/80">
                טבלת החזר חודשי למשכנתה הנדרשת - לפי תמהיל ותקופה
              </h3>
              <p className="text-xs text-foreground/50">
                ההחזר החודשי עבור סכום המשכנתה הנדרשת הקבוע (
                {currency.format(results.requiredMortgage)} ₪), לכל תמהיל
                ותקופה. התא המודגש הוא הזול ביותר.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--tico-line-strong)] text-right text-foreground/70">
                    <th className="py-2 pr-2">תמהיל</th>
                    {TERM_OPTIONS_YEARS.map((years) => (
                      <th key={years} className="py-2">
                        {years} שנה
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.requiredPaymentTable.map((row) => (
                    <tr key={row.mix.id} className="border-b border-[var(--tico-line)]">
                      <td className="py-2 pr-2 font-medium">{row.mix.label}</td>
                      {row.byTerm.map((payment, index) => (
                        <td
                          key={TERM_OPTIONS_YEARS[index]}
                          className={
                            payment === results.minMonthlyPayment
                              ? "py-2 font-semibold text-foreground"
                              : "py-2"
                          }
                        >
                          {currency.format(payment)} ₪
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground/80">
                טבלת יכולת מימון - לפי תמהיל ותקופת הלוואה
              </h3>
              <p className="text-xs text-foreground/50">
                יכולת ההחזר לפי ההכנסה בלבד (מדיניות עבודה של{" "}
                {WORKING_PTI_CAP_PERCENT}% מההכנסה הפנויה), לפי{" "}
                {LINKED_RATE_PERCENT}% ריבית במסלול צמוד מדד ו-
                {UNLINKED_RATE_PERCENT}% במסלול לא צמוד מדד - ללא הגבלת תקרת
                המימון (LTV), שמוצגת בנפרד בטבלה שלמעלה. השילוב המודגש הוא
                זה שמניב את המשכנתה הגבוהה ביותר, ולכן הוא הבסיס למשכנתה
                המקסימלית האפשרית שלמעלה.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--tico-line-strong)] text-right text-foreground/70">
                    <th className="py-2 pr-2">תמהיל</th>
                    {TERM_OPTIONS_YEARS.map((years) => (
                      <th key={years} className="py-2">
                        {years} שנה
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.capacityTable.map((row) => (
                    <tr key={row.mix.id} className="border-b border-[var(--tico-line)]">
                      <td className="py-2 pr-2 font-medium">
                        {row.mix.label}
                      </td>
                      {row.byTerm.map((cell, index) => (
                        <td
                          key={TERM_OPTIONS_YEARS[index]}
                          className={
                            row.mix.label === results.bestCapacityMixLabel &&
                            TERM_OPTIONS_YEARS[index] === results.bestCapacityTermYears
                              ? "py-2 font-semibold text-foreground"
                              : "py-2"
                          }
                        >
                          {currency.format(cell.amount)} ₪
                          <div className="text-xs font-normal text-foreground/50">
                            {currency.format(cell.payment)} ₪ / חודש
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ResultCard
                label="הון עצמי זמין (נזיל + ממכירת נכס קיים)"
                value={results.totalAvailableEquity}
              />
              <ResultCard
                label="סה״כ מזומן נדרש בסגירת העסקה"
                value={results.totalCashNeededAtClosing}
              />
              <ResultCard
                label="הכנסה פנויה אחרי ההחזר הרצוי"
                value={results.disposableIncomeAfterMortgage}
                warn={results.disposableIncomeAfterMortgage < 0}
              />
            </div>

            {results.equityShortfall > 0 ? (
              <div className="rounded-xl bg-[var(--tico-critical-soft)] px-4 py-3 text-sm text-[var(--tico-critical)]">
                ⚠️ חסר הון עצמי של {currency.format(results.equityShortfall)} ₪
                לכיסוי ההפרש בין שווי הנכס למשכנתה וההוצאות הנלוות (הבנק אינו
                מממן הוצאות נלוות).
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--tico-good-soft)] px-4 py-3 text-sm text-[var(--tico-good)]">
                ✅ ההון העצמי הזמין מכסה את ההפרש והוצאות העסקה, עם יתרה של{" "}
                {currency.format(results.equitySurplus)} ₪.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="whitespace-nowrap rounded-full border border-[var(--tico-line-strong)] bg-surface px-5 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
              >
                ייצוא ל-PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="whitespace-nowrap rounded-full border border-[var(--tico-line-strong)] bg-surface px-5 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
              >
                ייצוא לאקסל
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3 print:hidden">
              <p className="text-sm text-foreground/80">
                רוצים לוודא שהנתונים והחישוב מתאימים למקרה הספציפי שלכם? זה
                בדיוק מה שאני בודק בשיחה.
              </p>
              <a
                href={`https://wa.me/972507700322?text=${encodeURIComponent(
                  "היי צ'יקו! חישבתי במחשבון המשכנתה החכם, רוצה לבדוק את זה מולך."
                )}`}
                target="_blank"
                rel="noopener"
                className="whitespace-nowrap rounded-full border border-[var(--tico-line-strong)] bg-surface px-5 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
              >
                בדיקה מול היועץ ב-WhatsApp
              </a>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-[var(--tico-line)] bg-surface p-6 shadow-[var(--tico-shadow)]">
        <h2 className="text-lg font-semibold text-foreground">הערות</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-[var(--tico-line-strong)] px-3 py-2 outline-none focus:border-primary"
        />
      </section>

      <p className="text-xs text-foreground/50">
        המחשבון הוא כלי עזר להערכה בלבד ואינו מהווה ייעוץ פיננסי או התחייבות
        למתן אשראי. אישור המשכנתה בפועל, אחוז המימון וההחזר החודשי נתונים
        לשיקול דעת הבנק ולבדיקת יכולת ההחזר בפועל מול תלוש השכר.
      </p>
    </div>

    {/* דוח PDF מודפס - בעיצוב זהה לדוח הסקירה השנתי של Tico Finance
        (tico-annual-report), כדי שהמסמך שיוצא ללקוח ייראה ברמה מקצועית. */}
    <div className="hidden print:block tico-report">
      {hasEnoughData && (() => {
        const active = hasSecondBorrower ? borrowers : [borrowers[0]];
        const clientNames = active
          .map((b) => b.name)
          .filter(Boolean)
          .join(" ו");
        const badgeClass =
          results.actualPtiPercent <= WORKING_PTI_CAP_PERCENT
            ? "tico-report-badge-good"
            : "tico-report-badge-bad";
        return (
          <>
            <header className="tico-report-letterhead">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="tico-report-brand-mark"
                src="/tico-finance-logo.png"
                alt="TICO FINANCE — אדריכל המשכנתאות"
              />
              <div className="tico-report-doc-meta">
                {clientNames && (
                  <div>
                    <strong>עבור: </strong>
                    {clientNames}
                  </div>
                )}
                <div>
                  <strong>תאריך: </strong>
                  {formatDate(new Date())}
                </div>
                <div>
                  <strong>סוג עסקה: </strong>
                  {isMechirLamishtaken ? "מחיר למשתכן" : transactionType.label}
                </div>
              </div>
            </header>

            <div className="tico-report-title-block">
              <div className="tico-report-eyebrow">הערכת משכנתה</div>
              <h1 className="tico-report-title">כמה משכנתה מתאימה לכם</h1>
              <p className="tico-report-subtitle">
                סיכום החישוב לפי ההכנסות, ההתחייבויות ופרטי העסקה שהוזנו -
                יחס החזר, הכנסה פנויה ומשכנתה מקסימלית אפשרית.
              </p>
            </div>

            <section className="tico-report-section" style={{ marginTop: 4 }}>
              <div className="tico-report-section-head">
                <h2>המצב שלכם</h2>
              </div>
              <div
                className="tico-report-grid"
                style={{ "--tico-report-cols": 4 } as CSSProperties}
              >
                <div className="tico-report-card">
                  <div className="tico-report-card-k">סה״כ הכנסה</div>
                  <div className="tico-report-card-v">
                    {currency.format(results.totalIncome)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">סה״כ התחייבויות</div>
                  <div className="tico-report-card-v">
                    {currency.format(results.totalObligations)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">הכנסה פנויה</div>
                  <div className="tico-report-card-v">
                    {currency.format(results.disposableIncomeBeforeMortgage)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">יחס החזר</div>
                  <div className="tico-report-card-v">
                    {results.actualPtiPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>משכנתה מקסימלית אפשרית</h2>
              </div>
              <div className="tico-report-hero-grid">
                <div className="tico-report-hero-main">
                  <div className="tico-report-hero-label">
                    משכנתה מקסימלית אפשרית
                  </div>
                  <div className="tico-report-hero-number">
                    {currency.format(results.recommendedMortgage)}
                    <span className="tico-report-unit">₪</span>
                  </div>
                  <div className="tico-report-hero-sub">
                    {isMechirLamishtaken
                      ? `לפי כללי מחיר למשתכן (תקרת LTV ${Math.round(MECHIR_LTV * 100)}%)`
                      : `לפי ${transactionType.label} (תקרת LTV ${Math.round(transactionType.ltv * 100)}%)`}{" "}
                    ותקרת החזר {WORKING_PTI_CAP_PERCENT}% מההכנסה הפנויה · השילוב
                    המיטבי: {results.bestCapacityMixLabel},{" "}
                    {results.bestCapacityTermYears} שנה.
                    <br />
                    <span className={`tico-report-badge ${badgeClass}`}>
                      {results.fundingShortfall > 0
                        ? `⚠ חסר מימון של ${currency.format(results.fundingShortfall)} ₪`
                        : "✅ הסכום הנדרש לעסקה מכוסה"}
                    </span>
                  </div>
                </div>
                <div className="tico-report-hero-stats">
                  <div className="tico-report-card">
                    <div className="tico-report-card-k">
                      {useManualFinancingPercent
                        ? "משכנתה נדרשת (לפי אחוז מימון ידני)"
                        : "משכנתה נדרשת לעסקה"}
                    </div>
                    <div className="tico-report-card-v">
                      {currency.format(results.requiredMortgage)} ₪
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>לווים</h2>
              </div>
              <div className="tico-report-table-wrap">
                <table className="tico-report-table">
                  <thead>
                    <tr>
                      <th>לווה</th>
                      <th>גיל</th>
                      <th>עיסוק</th>
                      <th className="tico-report-num">הכנסה נטו</th>
                      <th className="tico-report-num">התחייבויות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((borrower, index) => (
                      <tr key={index}>
                        <td className="tico-report-row-label">
                          {borrower.name || `לווה ${index + 1}`}
                        </td>
                        <td>{borrower.age}</td>
                        <td>{EMPLOYMENT_TYPE_LABELS[borrower.employmentType]}</td>
                        <td className="tico-report-num">
                          {currency.format(borrower.netIncome)} ₪
                        </td>
                        <td className="tico-report-num">
                          {currency.format(borrower.obligations)} ₪
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>החזר חודשי</h2>
              </div>
              <div className="tico-report-table-wrap">
                <table className="tico-report-table">
                  <thead>
                    <tr>
                      <th>סוג החזר</th>
                      <th>תמהיל ותקופה</th>
                      <th className="tico-report-num">סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="tico-report-row-label">
                        מינימלי (הזול מכל האפשרויות, למשכנתה הנדרשת)
                      </td>
                      <td>
                        {results.bestCapacityMixLabel},{" "}
                        {results.bestCapacityTermYears} שנה
                      </td>
                      <td className="tico-report-num">
                        {currency.format(results.minMonthlyPayment)} ₪
                      </td>
                    </tr>
                    <tr>
                      <td className="tico-report-row-label">
                        רצוי (לתקרת יכולת המימון, {WORKING_PTI_CAP_PERCENT}%)
                      </td>
                      <td>
                        {results.bestCapacityMixLabel},{" "}
                        {results.bestCapacityTermYears} שנה
                      </td>
                      <td className="tico-report-num">
                        {currency.format(results.desiredMonthlyPayment)} ₪
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>החזר חודשי למשכנתה הנדרשת - לפי תמהיל ותקופה</h2>
                <div className="tico-report-section-note">
                  עבור {currency.format(results.requiredMortgage)} ₪ · התא
                  המודגש הוא הזול ביותר
                </div>
              </div>
              <div className="tico-report-table-wrap">
                <table className="tico-report-table">
                  <thead>
                    <tr>
                      <th>תמהיל</th>
                      {TERM_OPTIONS_YEARS.map((years) => (
                        <th key={years} className="tico-report-num">
                          {years} שנה
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.requiredPaymentTable.map((row) => (
                      <tr key={row.mix.id}>
                        <td className="tico-report-row-label">{row.mix.label}</td>
                        {row.byTerm.map((payment, index) => (
                          <td
                            key={TERM_OPTIONS_YEARS[index]}
                            className="tico-report-num"
                            style={payment === results.minMonthlyPayment ? { fontWeight: 800 } : undefined}
                          >
                            {currency.format(payment)} ₪
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>יכולת מימון לפי תמהיל ותקופה</h2>
                <div className="tico-report-section-note">
                  לפי הכנסה בלבד, ללא תקרת LTV · מתחת לכל סכום - ההחזר החודשי
                  שלו
                </div>
              </div>
              <div className="tico-report-table-wrap">
                <table className="tico-report-table">
                  <thead>
                    <tr>
                      <th>תמהיל</th>
                      {TERM_OPTIONS_YEARS.map((years) => (
                        <th key={years} className="tico-report-num">
                          {years} שנה
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.capacityTable.map((row) => (
                      <tr key={row.mix.id}>
                        <td className="tico-report-row-label">{row.mix.label}</td>
                        {row.byTerm.map((cell, index) => {
                          const isBest =
                            row.mix.label === results.bestCapacityMixLabel &&
                            TERM_OPTIONS_YEARS[index] === results.bestCapacityTermYears;
                          return (
                            <td
                              key={TERM_OPTIONS_YEARS[index]}
                              className="tico-report-num"
                              style={isBest ? { fontWeight: 800 } : undefined}
                            >
                              {currency.format(cell.amount)} ₪
                              <div style={{ fontSize: 10, color: "#818c82", fontWeight: 400 }}>
                                {currency.format(cell.payment)} ₪ / חודש
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tico-report-section">
              <div className="tico-report-section-head">
                <h2>פרטי העסקה</h2>
              </div>
              <div
                className="tico-report-grid"
                style={{ "--tico-report-cols": 4 } as CSSProperties}
              >
                <div className="tico-report-card">
                  <div className="tico-report-card-k">שווי נכס נרכש</div>
                  <div className="tico-report-card-v">
                    {currency.format(effectivePropertyValue)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">הון עצמי זמין</div>
                  <div className="tico-report-card-v">
                    {currency.format(results.totalAvailableEquity)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">הוצאות נלוות</div>
                  <div className="tico-report-card-v">
                    {currency.format(results.totalAssociatedCosts)} ₪
                  </div>
                </div>
                <div className="tico-report-card">
                  <div className="tico-report-card-k">
                    סה״כ מזומן נדרש בסגירה
                  </div>
                  <div className="tico-report-card-v">
                    {currency.format(results.totalCashNeededAtClosing)} ₪
                  </div>
                </div>
              </div>
              {isMechirLamishtaken && (
                <div
                  className="tico-report-grid"
                  style={{ "--tico-report-cols": 3, marginTop: 10 } as CSSProperties}
                >
                  <div className="tico-report-card">
                    <div className="tico-report-card-k">שווי שוק (לפני הנחה)</div>
                    <div className="tico-report-card-v">
                      {currency.format(mechirMarketValue)} ₪
                    </div>
                  </div>
                  <div className="tico-report-card">
                    <div className="tico-report-card-k">הנחה (מחיר למשתכן)</div>
                    <div className="tico-report-card-v">
                      {currency.format(mechirDiscount)} ₪
                    </div>
                  </div>
                  <div className="tico-report-card">
                    <div className="tico-report-card-k">מענק מקום</div>
                    <div className="tico-report-card-v">
                      {currency.format(mechirGrant)} ₪
                    </div>
                  </div>
                </div>
              )}
              <p className="tico-report-section-note" style={{ marginTop: 8 }}>
                {results.equityShortfall > 0
                  ? `⚠ חסר הון עצמי של ${currency.format(results.equityShortfall)} ₪ לכיסוי ההפרש והוצאות העסקה (הבנק אינו מממן הוצאות נלוות).`
                  : `✅ ההון העצמי מכסה את ההפרש והוצאות העסקה, יתרה של ${currency.format(results.equitySurplus)} ₪.`}
              </p>
            </section>

            {notes && (
              <section className="tico-report-section">
                <div className="tico-report-section-head">
                  <h2>הערות</h2>
                </div>
                <p style={{ fontSize: 12, color: "#5a5a7a" }}>{notes}</p>
              </section>
            )}

            <div className="tico-report-closing">
              <p>
                הנתונים הם הערכה בלבד. נשמח לעבור עליהם יחד בשיחה ולהתאים
                את התמהיל למקרה הספציפי שלכם.
              </p>
              <div className="tico-report-signoff">
                צ׳יקו זוויבל
                <span>אדריכל המשכנתאות</span>
              </div>
            </div>

            <div className="tico-report-disclaimer">
              * המחשבון הוא כלי עזר להערכה בלבד ואינו מהווה ייעוץ פיננסי או
              התחייבות למתן אשראי. אישור המשכנתה בפועל, אחוז המימון וההחזר
              החודשי נתונים לשיקול דעת הבנק ולבדיקת יכולת ההחזר בפועל מול
              תלוש השכר.
            </div>
          </>
        );
      })()}
    </div>
    </>
  );
}

function BorrowerCard({
  title,
  borrower,
  onChange,
}: {
  title: string;
  borrower: Borrower;
  onChange: (patch: Partial<Borrower>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
      <Field label="שם">
        <TextInput
          value={borrower.name}
          onChange={(value) => onChange({ name: value })}
        />
      </Field>
      <Field label="גיל" suffix="שנים">
        <NumberInput
          value={borrower.age}
          onChange={(value) => onChange({ age: value })}
          min={18}
          max={90}
        />
      </Field>
      <Field label="מקצוע">
        <TextInput
          value={borrower.profession}
          onChange={(value) => onChange({ profession: value })}
        />
      </Field>
      <Field label="סוג עיסוק">
        <select
          value={borrower.employmentType}
          onChange={(e) =>
            onChange({ employmentType: e.target.value as EmploymentType })
          }
          className="w-full rounded-lg border border-[var(--tico-line-strong)] px-3 py-2 outline-none focus:border-primary"
        >
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {borrower.employmentType === "self-employed" && (
        <p className="text-xs text-foreground/50">
          לעצמאים: יש להזין הכנסה נטו ממוצעת כפי שתוכר על ידי הבנק (בד״כ
          ממוצע 2-3 שנים אחרונות).
        </p>
      )}
      <Field label="הכנסה נטו" suffix="₪">
        <NumberInput
          value={borrower.netIncome}
          onChange={(value) => onChange({ netIncome: value })}
          min={0}
        />
      </Field>
      <Field label="התחייבויות חודשיות" suffix="₪">
        <NumberInput
          value={borrower.obligations}
          onChange={(value) => onChange({ obligations: value })}
          min={0}
        />
      </Field>
      <Field label="הכנסות נוספות (ברוטו)" suffix="₪">
        <NumberInput
          value={borrower.additionalIncome}
          onChange={(value) => onChange({ additionalIncome: value })}
          min={0}
        />
      </Field>
      <Field label="התנהלות אשראית">
        <select
          value={borrower.creditConduct}
          onChange={(e) =>
            onChange({ creditConduct: e.target.value as CreditConduct })
          }
          className="w-full rounded-lg border border-[var(--tico-line-strong)] px-3 py-2 outline-none focus:border-primary"
        >
          {Object.entries(CREDIT_CONDUCT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {borrower.creditConduct !== "good" && (
        <p className="text-xs text-[var(--tico-warn)]">
          ⚠️ ייתכן שהדבר ישפיע על אישור העסקה בבנק, מעבר לחישוב המספרי.
        </p>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-background px-4 py-3">
      <span className="text-xs text-foreground/50">{label}</span>
      <span
        className={`text-lg font-semibold ${
          warn ? "text-[var(--tico-critical)]" : "text-foreground"
        }`}
      >
        {currency.format(value)} ₪
      </span>
    </div>
  );
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {children}
        {suffix && <span className="text-foreground/50">{suffix}</span>}
      </div>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={numberInputValue(value)}
      onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      min={min}
      max={max}
      step={step ?? 1}
      dir="ltr"
      className="w-full rounded-lg border border-[var(--tico-line-strong)] px-3 py-2 text-left outline-none focus:border-primary"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--tico-line-strong)] px-3 py-2 outline-none focus:border-primary"
    />
  );
}
