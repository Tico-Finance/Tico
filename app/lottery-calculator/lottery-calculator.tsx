"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  DEFAULT_SIZES,
  GRANT_OPTIONS,
  MIN_EQUITY_NO_GRANT,
  MIN_EQUITY_WITH_GRANT,
  MORTGAGE_INTEREST_RATE_PERCENT,
  MORTGAGE_TERM_YEARS,
  PARKING_PRICE,
  calculateLottery,
  type ApartmentSize,
  type LotteryInput,
} from "@/lib/lottery-calc";
import ReportRequest from "./report-request";

const currency = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});

function numberInputValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function HelpTip({
  text,
  imageSrc,
  imageAlt,
  imageWidth,
  imageHeight,
}: {
  text: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverCapableRef = useRef(false);

  useEffect(() => {
    hoverCapableRef.current = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
  }, []);

  // ממקם את החלונית עם קואורדינטות מוחלטות ביחס ל-viewport (position: fixed)
  // ומהדק אותה לגבולות המסך - כך שהיא לא תיחתך או תזוז בצורה מוזרה במובייל,
  // ללא תלות באיפה בדיוק כפתור ה-"?" נופל כשתווית השדה עוברת שורה.
  const updatePosition = useCallback(() => {
    const btn = wrapperRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const panelWidth = Math.min(288, window.innerWidth - margin * 2);
    let left = rect.right - panelWidth;
    left = Math.min(left, window.innerWidth - panelWidth - margin);
    left = Math.max(left, margin);
    const top = rect.bottom + 8;
    setPos({ top, left, width: panelWidth });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    // סגירת ה"נעיצה" בלחיצה מחוץ לחלונית - hover נסגר ממילא ב-mouseleave.
    function handleOutsideClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setPinned(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => hoverCapableRef.current && setHover(true)}
      onMouseLeave={() => hoverCapableRef.current && setHover(false)}
    >
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        aria-label="איפה למצוא את זה באתר ההגרלה"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-foreground/30 text-[10px] font-bold leading-none text-foreground/50 transition-colors hover:border-primary hover:text-primary"
      >
        ?
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-50 rounded-xl border border-black/10 bg-surface p-3 text-right normal-case shadow-lg"
        >
          <p className="mb-2 text-xs font-normal text-foreground/80">{text}</p>
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="h-auto w-full rounded-lg border border-black/10"
          />
        </div>
      )}
    </span>
  );
}

export default function LotteryCalculator() {
  // נתוני ההגרלה - משתנים מהגרלה להגרלה
  const [pricePerSqm, setPricePerSqm] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(25);
  const [discountCap, setDiscountCap] = useState<number>(500000);
  const [referencePrice, setReferencePrice] = useState<number>(0);
  const [balconySqm, setBalconySqm] = useState<number>(12);
  const [storageSqm, setStorageSqm] = useState<number>(6);
  const [parkingCount, setParkingCount] = useState<number>(1);
  const [grant, setGrant] = useState<number>(0);
  // מ״ר עיקרי לכל גודל - ברירת מחדל סטנדרטית, ניתנת לעדכון כשידוע המ״ר
  // המדויק של הדירה הספציפית (הגדלים הקבועים הם ממוצע בלבד).
  const [sizes, setSizes] = useState<ApartmentSize[]>(DEFAULT_SIZES);

  const updateMainSqm = (id: number, mainSqm: number) => {
    setSizes((prev) => prev.map((s) => (s.id === id ? { ...s, mainSqm } : s)));
  };

  const input = useMemo<LotteryInput>(
    () => ({
      sizes,
      pricePerSqm,
      discountPercent,
      discountCap,
      referencePrice,
      balconySqm,
      storageSqm,
      parkingCount,
      grant,
    }),
    [
      sizes,
      pricePerSqm,
      discountPercent,
      discountCap,
      referencePrice,
      balconySqm,
      storageSqm,
      parkingCount,
      grant,
    ]
  );
  const results = useMemo(() => calculateLottery(input), [input]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-primary">נתוני ההגרלה</h2>
          <p className="text-xs text-foreground/50">משתנים מהגרלה להגרלה - יש למלא לפי הפרטים באתר.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="מחיר מוצג למ״ר (ללא מע״מ, ללא הצמדה)"
            suffix="₪"
            help={
              <HelpTip
                text={'בעמוד הדירה הספציפית באתר ההגרלה, בכרטיס "מחיר", מופיעה השורה "מחיר למטר" - זה המספר שיש להזין כאן (מסומן בירוק בתמונה).'}
                imageSrc="/lottery-calculator/price-example.jpg"
                imageAlt="דוגמה לכרטיס מחיר באתר ההגרלה, עם מחיר למטר מסומן"
                imageWidth={800}
                imageHeight={460}
              />
            }
          >
            <NumberInput
              value={pricePerSqm}
              onChange={setPricePerSqm}
              min={0}
            />
          </Field>
          <Field
            label="אחוז הנחה (מסלול א׳)"
            suffix="%"
            help={
              <HelpTip
                text={'מתחת לכרטיס המחיר, בכרטיס "הערה", כתובה נוסחת ההנחה: הנמוך מבין אחוז מסוים (למשל 25%, מסומן בירוק בתמונה) לבין תקרה בש״ח. האחוז הוא המספר הזה.'}
                imageSrc="/lottery-calculator/note-percent-example.jpg"
                imageAlt="דוגמה לכרטיס הערה עם אחוז ההנחה מסומן"
                imageWidth={800}
                imageHeight={592}
              />
            }
          >
            <NumberInput
              value={discountPercent}
              onChange={setDiscountPercent}
              min={0}
            />
          </Field>
          <Field
            label="תקרת הנחה מקסימלית (מסלול ב׳)"
            suffix="₪"
            help={
              <HelpTip
                text={'באותו כרטיס "הערה", התקרה בש״ח (למשל 500,000 ₪, מסומנת בירוק בתמונה) היא המספר השני בנוסחת ההנחה - ההנחה בפועל היא הנמוך מבין האחוז לתקרה.'}
                imageSrc="/lottery-calculator/note-cap-example.jpg"
                imageAlt="דוגמה לכרטיס הערה עם תקרת ההנחה מסומנת"
                imageWidth={800}
                imageHeight={592}
              />
            }
          >
            <NumberInput value={discountCap} onChange={setDiscountCap} min={0} />
          </Field>
          <Field
            label="מחיר ייחוס בהערות (ללא מע״מ, למ״ר)"
            suffix="₪"
            help={
              <HelpTip
                text={'באותו כרטיס "הערה", "מחיר הדירה המעודכן" למ״ר (מסומן בירוק בתמונה) - זה שווי השוק הרשמי של הפרויקט, ומשמש לחישוב המשכנתה (לא לחישוב ההנחה).'}
                imageSrc="/lottery-calculator/note-reference-example.jpg"
                imageAlt="דוגמה לכרטיס הערה עם מחיר הדירה המעודכן מסומן"
                imageWidth={800}
                imageHeight={592}
              />
            }
          >
            <NumberInput
              value={referencePrice}
              onChange={setReferencePrice}
              min={0}
            />
          </Field>
          <Field label="גודל מרפסת" suffix="מ״ר">
            <NumberInput value={balconySqm} onChange={setBalconySqm} min={0} />
          </Field>
          <Field label="גודל מחסן" suffix="מ״ר">
            <NumberInput value={storageSqm} onChange={setStorageSqm} min={0} />
          </Field>
          <Field label="מספר חניות" suffix={`× ${currency.format(PARKING_PRICE)} ₪`}>
            <NumberInput value={parkingCount} onChange={setParkingCount} min={0} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground/80">
            מ״ר עיקרי בפועל
          </p>
          <p className="mb-2 text-xs text-foreground/50">
            הגדלים למטה הם ממוצע סטנדרטי - אם ידוע המ״ר המדויק של הדירה
            הספציפית מתוך אתר ההגרלה, אפשר לעדכן אותו כאן.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sizes.map((size) => (
              <Field key={size.id} label={size.label} suffix="מ״ר">
                <NumberInput
                  value={size.mainSqm}
                  onChange={(value) => updateMainSqm(size.id, value)}
                  min={0}
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">מענק מקום</h2>
        <div className="flex flex-wrap gap-4">
          {GRANT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm text-foreground/80"
            >
              <input
                type="radio"
                name="grant"
                checked={grant === option.value}
                onChange={() => setGrant(option.value)}
                className="h-4 w-4"
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">מחיר דירה</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-right text-foreground/70">
                <th className="py-2 pr-2">גודל</th>
                <th className="py-2">מ״ר לחישוב</th>
                <th className="py-2">מחיר לפני הנחה (כולל מע״מ)</th>
                <th className="py-2">הנחה בפועל</th>
                <th className="py-2">מסלול קובע</th>
                <th className="py-2">מחיר דירה</th>
                <th className="py-2">מחיר חוזה (כולל חניה)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.size.id} className="border-b border-black/5">
                  <td className="py-2 pr-2 font-medium">
                    {row.size.label}
                    <span className="text-foreground/50">
                      {" "}
                      ({row.size.mainSqm} מ״ר)
                    </span>
                  </td>
                  <td className="py-2">{row.calcSqm.toFixed(1)}</td>
                  <td className="py-2">
                    {currency.format(row.preDiscountIncVat)} ₪
                  </td>
                  <td className="py-2">{currency.format(row.discount)} ₪</td>
                  <td className="py-2">{row.boundBy}</td>
                  <td className="py-2">
                    {currency.format(row.finalIncVat)} ₪
                  </td>
                  <td className="py-2 font-semibold text-primary">
                    {currency.format(row.contractPrice)} ₪
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pricePerSqm <= 0 && (
          <p className="text-sm text-foreground/60">
            הזינו מחיר מוצג למ״ר כדי לראות תוצאות.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            הון עצמי ומשכנתא (לפי כללי מחיר למשתכן)
          </h2>
          <p className="text-xs text-foreground/50">
            משכנתא של עד 75% משווי השוק (מחיר ייחוס אם הוזן, אחרת המחיר לפני
            הנחה); אם שווי השוק עולה על 2.1 מיליון ₪, המשכנתא מבוססת על הגבוה
            מבין 2.1 מיליון ₪ למחיר החוזה. בכפוף למינימום הון עצמי -{" "}
            {currency.format(MIN_EQUITY_WITH_GRANT)} ₪ אם יש מענק מקום,
            אחרת {currency.format(MIN_EQUITY_NO_GRANT)} ₪. ההחזר החודשי
            מוערך לפי ריבית ממוצעת לדוגמה של{" "}
            {MORTGAGE_INTEREST_RATE_PERCENT}% - אינו הצעה מחייבת מבנק כלשהו.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-right text-foreground/70">
                <th className="py-2 pr-2">גודל</th>
                <th className="py-2">מחיר חוזה</th>
                <th className="py-2">הון עצמי נדרש</th>
                <th className="py-2">מענק מקום</th>
                <th className="py-2">גובה משכנתא</th>
                {MORTGAGE_TERM_YEARS.map((years) => (
                  <th key={years} className="py-2">
                    החזר חודשי ל-{years} שנה
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.size.id} className="border-b border-black/5">
                  <td className="py-2 pr-2 font-medium">
                    {row.size.label}
                    <span className="text-foreground/50">
                      {" "}
                      ({row.size.mainSqm} מ״ר)
                    </span>
                  </td>
                  <td className="py-2">{currency.format(row.contractPrice)} ₪</td>
                  <td className="py-2 font-semibold text-primary">
                    {currency.format(row.equity)} ₪
                  </td>
                  <td className="py-2">{currency.format(grant)} ₪</td>
                  <td className="py-2">{currency.format(row.mortgage)} ₪</td>
                  {MORTGAGE_TERM_YEARS.map((years) => (
                    <td key={years} className="py-2">
                      {currency.format(row.monthlyPayments[years])} ₪
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
          <p className="text-sm text-foreground/80">
            רוצים לבדוק אם ההכנסה שלכם מתאימה להחזר הזה? זה בדיוק מה שאני
            בודק בשיחה.
          </p>
          <a
            href="https://wa.me/972507700322?text=%D7%94%D7%99%D7%99%20%D7%A6%27%D7%99%D7%A7%D7%95!%20%D7%A8%D7%90%D7%99%D7%AA%D7%99%20%D7%91%D7%9E%D7%97%D7%A9%D7%91%D7%95%D7%9F%20%D7%90%D7%AA%20%D7%94%D7%94%D7%97%D7%96%D7%A8%20%D7%94%D7%97%D7%95%D7%93%D7%A9%D7%99%20%D7%94%D7%A6%D7%A4%D7%95%D7%99%2C%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%91%D7%93%D7%95%D7%A7%20%D7%90%D7%9D%20%D7%94%D7%94%D7%9B%D7%A0%D7%A1%D7%94%20%D7%A9%D7%9C%D7%99%20%D7%9E%D7%AA%D7%90%D7%99%D7%9E%D7%94%20%D7%9C%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%94%20%D7%94%D7%96%D7%95."
            target="_blank"
            rel="noopener"
            className="whitespace-nowrap rounded-full bg-button px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            בדיקה מול היועץ ב-WhatsApp
          </a>
        </div>
      </section>

      <ReportRequest input={input} ready={pricePerSqm > 0} />

      <p className="text-xs text-foreground/50">
        המחשבון הוא כלי עזר להערכה בלבד ואינו מהווה ייעוץ פיננסי. יש לבדוק
        את פרטי ההגרלה המדויקים באתר הרשמי ואת תנאי המימון מול הבנק לפני
        קבלת החלטה.
      </p>
    </div>
  );
}

function Field({
  label,
  suffix,
  help,
  children,
}: {
  label: string;
  suffix?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
      <span className="flex items-center gap-1.5">
        {label}
        {help}
      </span>
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
      className="w-full rounded-lg border border-black/10 px-3 py-2 text-left outline-none focus:border-primary"
    />
  );
}
