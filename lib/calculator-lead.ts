// הגדרות משותפות ללקוח ולשרת עבור הורדת הדוח והקופון ממחשבון ההגרלות.

// חובה: כדי לקבל את הדוח צריך להשאיר שם, טלפון ומייל ולסמן הסכמה לדיוור.
export const REQUIRE_MARKETING_CONSENT = true;

// הנוסח המדויק שמוצג ללקוח - נשמר יחד עם תאריך ההסכמה כהוכחה.
export const MARKETING_CONSENT_TEXT =
  "אני מאשר/ת קבלת דיוור מ-TICO FINANCE בדואר אלקטרוני: תכנים, טיפים ועדכונים על משכנתאות ודיור. אפשר להסיר בכל עת.";

export const COUPON_DISCOUNT_PERCENT = 20;
export const COUPON_VALID_DAYS = 60;

export function normalizeIsraeliPhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+972")) d = "0" + d.slice(4);
  else if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^0\d{8,9}$/.test(d) ? d : null;
}
