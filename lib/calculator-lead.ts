// הגדרות משותפות ללקוח ולשרת עבור הורדת הדוח והקופון ממחשבון ההגרלות.

// אם true - חובה לסמן הסכמה לדיוור כדי לקבל את הדוח. מומלץ להשאיר false:
// הפרטים (שם, טלפון, מייל) חובה, וההסכמה לדיוור היא תיבה נפרדת.
export const REQUIRE_MARKETING_CONSENT = false;

// הנוסח המדויק שמוצג ללקוח - נשמר יחד עם תאריך ההסכמה כהוכחה.
export const MARKETING_CONSENT_TEXT =
  "אני מאשר/ת לקבל מ-TICO FINANCE תכנים, טיפים ועדכונים על משכנתאות ודיור בדואר אלקטרוני. אפשר להסיר בכל עת.";

export const COUPON_DISCOUNT_PERCENT = 20;
export const COUPON_VALID_DAYS = 60;

export function normalizeIsraeliPhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+972")) d = "0" + d.slice(4);
  else if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^0\d{8,9}$/.test(d) ? d : null;
}
