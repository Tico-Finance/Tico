import { z } from "zod";
import { whatsappLink } from "./leads";

// Shared definitions for the partners module (brokers, sales offices, brokerages):
// stages, the follow-up cadence, and the outreach message templates. Pure functions only,
// so the rules can be unit-tested and used from server actions and client components alike.

export const PARTNER_KINDS = ["broker", "sales", "office"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export const KIND_LABELS: Record<PartnerKind, string> = {
  broker: "מתווך",
  sales: "משרד מכירות / פרויקט",
  office: "משרד תיווך",
};

export const PARTNER_STAGES = [
  "cold",
  "warm",
  "sent",
  "remind",
  "replied",
  "meeting",
  "met",
  "visited",
  "coupon",
  "partner",
  "quiet",
  "dead",
] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];
export const STAGE_LABELS: Record<PartnerStage, string> = {
  cold: "לא נוצר קשר",
  warm: "בחימום באינסטגרם",
  sent: "נשלחה הודעה",
  remind: "נשלחה פנייה שנייה",
  replied: "ענו",
  meeting: "נקבעה פגישה",
  met: "נפגשנו",
  visited: "בוצע ביקור",
  coupon: "הקופון נשלח",
  partner: "שיתוף פעולה",
  quiet: "חימום שקט",
  dead: "לא רלוונטי / ביקש להפסיק",
};

/** Board columns: each column groups one or more stages. "dead" is not on the board. */
export const BOARD_COLUMNS: { title: string; stages: PartnerStage[] }[] = [
  { title: "לא נוצר קשר", stages: ["cold"] },
  { title: "חימום", stages: ["warm"] },
  { title: "בפנייה", stages: ["sent", "remind"] },
  { title: "בשיחה", stages: ["replied", "meeting"] },
  { title: "נפגשנו", stages: ["met", "visited"] },
  { title: "קופון / שיתוף", stages: ["coupon", "partner"] },
  { title: "חימום שקט", stages: ["quiet"] },
];

export const WAVES = ["1", "2", "quiet", "last", "tbd"] as const;
export const WAVE_LABELS: Record<string, string> = {
  "1": "גל 1",
  "2": "גל 2",
  quiet: "חימום שקט בלבד",
  last: "בסוף",
  tbd: "לא נקבע",
};

/** Messages a day, so the business WhatsApp number stays safe. */
export const DAILY_CAP = 25;

// ── Dates (Israel time, YYYY-MM-DD strings) ──

export function todayIL(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
}

/** A moment this many hours in the past. */
export const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

// ── Cadence: what happens after each action ──

export const PARTNER_ACTIONS = [
  "startWarm",
  "sentMsg",
  "sentReminder",
  "noReply",
  "replied",
  "meetingSet",
  "met",
  "couponSent",
  "partner",
  "stop",
  "visit",
  "afterVisit",
  "followMsg",
] as const;
export type PartnerAction = (typeof PARTNER_ACTIONS)[number];

export type ActionOutcome = {
  stage: PartnerStage;
  nextAt: string | null;
  nextAction: string;
  eventKind: PartnerAction;
  eventText: string;
  followDate?: string;
  coupon?: true;
};

/** Event kinds that count as an outgoing message, for the daily counter. */
export const SENT_EVENT_KINDS: PartnerAction[] = ["sentMsg", "sentReminder", "couponSent", "afterVisit", "followMsg"];

export function planAction(action: PartnerAction, today: string): ActionOutcome {
  const o = (
    stage: PartnerStage,
    days: number | null,
    nextAction: string,
    eventText: string,
    extra: Partial<ActionOutcome> = {}
  ): ActionOutcome => ({
    stage,
    nextAt: days === null ? null : addDays(today, days),
    nextAction,
    eventKind: action,
    eventText,
    ...extra,
  });
  switch (action) {
    case "startWarm":
      return o("warm", 4, "לשלוח הודעה ראשונה", "התחיל חימום (עוקב)", { followDate: today });
    case "sentMsg":
      return o("sent", 6, "פנייה שנייה עם משהו שימושי בתוכה (לא \"רק מזכיר\")", "נשלחה הודעה ראשונה");
    case "sentReminder":
      return o("remind", 7, "אין מענה? עוברים לחימום שקט", "נשלחה פנייה שנייה");
    case "noReply":
      return o("quiet", 75, "ווי חדש אחרי חודשיים–שלושה (בינתיים לייק או תגובה)", "אין מענה. עוצרים וחוזרים בעוד חודשיים–שלושה");
    case "replied":
      return o("replied", 1, "להציע קפה ולקבוע פגישה", "ענה");
    case "meetingSet":
      return o("meeting", 3, "לוודא תאריך ושעת פגישה (עדכן את התאריך)", "נקבעה פגישה");
    case "met":
      return o("met", 1, "הודעת וואטסאפ אחרי הפגישה, ואז לשקול קופון", "נפגשנו");
    case "couponSent":
      return o("coupon", 14, "מעקב: האם הקופון נוצל? האם יש לקוח?", "נשלח קופון", { coupon: true });
    case "partner":
      return o("partner", null, "לשמור על קשר קבוע", "שיתוף פעולה");
    case "stop":
      return o("dead", null, "אין לפנות שוב", "לא מעוניין / ביקש להפסיק");
    case "visit":
      return o("visited", 0, "הודעה אחרי הביקור, אותו יום", "בוצע ביקור");
    case "afterVisit":
      return o("sent", 10, "מעקב בוואטסאפ", "נשלחה הודעה אחרי הביקור");
    case "followMsg":
      return o("sent", 10, "מעקב נוסף או קביעת שיחה", "נשלח מעקב");
  }
}

/** Which action buttons make sense for a partner in this stage. "stop" is always offered except when dead. */
export function availableActions(kind: PartnerKind, stage: PartnerStage): PartnerAction[] {
  const out: PartnerAction[] = [];
  const has = (...s: PartnerStage[]) => s.includes(stage);
  if (kind === "broker") {
    if (has("cold")) out.push("startWarm");
    if (has("warm", "cold")) out.push("sentMsg");
    if (has("sent")) out.push("sentReminder");
    if (has("remind")) out.push("noReply");
    if (has("warm", "sent", "remind", "quiet")) out.push("replied");
    if (has("replied")) out.push("meetingSet");
    if (has("meeting")) out.push("met");
    if (has("met", "replied", "meeting")) out.push("couponSent");
    if (has("met", "coupon")) out.push("partner");
    if (has("quiet")) out.push("sentMsg");
  } else {
    if (has("cold", "quiet")) out.push("visit");
    if (has("visited")) out.push("afterVisit");
    if (has("sent")) out.push("followMsg");
    if (has("sent", "visited")) out.push("replied");
    if (has("replied")) out.push("meetingSet");
    if (has("meeting")) out.push("met");
    if (has("met")) out.push("partner");
    if (has("sent", "remind", "visited")) out.push("noReply");
  }
  if (stage !== "dead") out.push("stop");
  return out;
}

export const ACTION_LABELS: Record<PartnerAction, string> = {
  startWarm: "התחלתי חימום",
  sentMsg: "שלחתי הודעה",
  sentReminder: "שלחתי פנייה שנייה",
  noReply: "אין מענה",
  replied: "ענה",
  meetingSet: "נקבעה פגישה",
  met: "נפגשנו",
  couponSent: "שלחתי קופון",
  partner: "שיתוף פעולה",
  stop: "לא מעוניין",
  visit: "ביקרתי",
  afterVisit: "שלחתי הודעה אחרי ביקור",
  followMsg: "שלחתי מעקב",
};

// ── Message templates: every opener is a "hook" that gives or asks something small and specific ──

export type MessageTemplate = {
  id: string;
  group: string;
  title: string;
  /** Opening hook that can be assigned to a partner and measured. */
  hook?: boolean;
  /** What must be prepared before sending. */
  prep?: string;
  body: string;
};

export const TEMPLATES: MessageTemplate[] = [
  {
    id: "h_q", hook: true, group: "מתווכים – פתיחים (ווים)", title: "שאלה אחת על העסקאות שלו",
    prep: "להחליף את הסוגריים במשהו אמיתי שפרסם.",
    body: "היי [שם], צ'יקו, יועץ משכנתאות פה ברחובות. ראיתי את [משהו ספציפי שהוא פרסם]. שאלה אחת, בלי שום הצעה: בעסקאות שלך, איפה דברים נתקעים הכי הרבה, במימון או במקום אחר? אני אוסף תמונה מהשטח ואשמח לשמוע אותך.",
  },
  {
    id: "h_card", hook: true, group: "מתווכים – פתיחים (ווים)", title: "כרטיס מימון מוכן לנכס שלו",
    prep: "להכין כרטיס לנכס אמיתי שפרסם (קנבה, מותג TICO): הון עצמי נדרש והחזר חודשי בשלושה תרחישים. מספרים רק מהנתונים של הנכס, ועם \"הערכה בלבד\".",
    body: "היי [שם], ראיתי את [הנכס או הפרויקט שפרסמת]. הכנתי לו כרטיס מימון קטן: כמה הון עצמי קונה צריך וכמה ההחזר החודשי בשלושה תרחישים. כדי שיהיה לך לסטורי או לשליחה ללקוחות, עם השם שלך. לשלוח לך? (הערכה בלבד, לא התחייבות בנקאית)",
  },
  {
    id: "h_pod", hook: true, group: "מתווכים – פתיחים (ווים)", title: "הזמנה לפרק בפודקאסט \"תשואה משולשת\"",
    prep: "להשלים פרט אמיתי מהפרופיל שלו. ההזמנה חייבת להיות כנה: אם אין סיכוי להקליט איתו, אל תשלח.",
    body: "היי [שם], צ'יקו, מנחה בפודקאסט \"תשואה משולשת\" על משכנתאות ונדל\"ן. אני מחפש מתווכים צעירים ברחובות והסביבה לשיחה על איך בונים שם בשוק הזה, ונראה לי ש[פרט ספציפי מהפרופיל שלו] זה בדיוק הסיפור. בא לך להצטרף לפרק? קודם קפה, נראה אם יש כימיה.",
  },
  {
    id: "h_launch", hook: true, group: "מתווכים – פתיחים (ווים)", title: "מפגש בהשקת KEDEM TOWER (20.11)",
    prep: "רלוונטי רק לפני 20.11 ורק למי שקשור לרובע קדם.",
    body: "היי [שם], צ'יקו, יועץ משכנתאות ברחובות. אני מגיע להשקה של KEDEM TOWER ביום שישי 20.11. אתה שם? אשמח לעצור להגיד שלום ולשמוע איך הלקוחות מגיבים בשלב המימון. קפה עליי.",
  },
  {
    id: "h_voice", hook: true, group: "מתווכים – פתיחים (ווים)", title: "הודעה קולית של 20 שניות (תסריט)",
    prep: "להקליט בקול, לא לשלוח כתובה. הודעה קולית בולטת על רקע המון טקסט. רק אם ההבטחה בסוף נכונה.",
    body: "היי [שם], צ'יקו פה, יועץ משכנתאות ברחובות. ראיתי את [משהו ספציפי] ורציתי להגיד שיפה. אני מכיר בימים אלה מתווכים בעיר שאני רוצה לעבוד איתם לאורך זמן, ואם יש לקוח שלך שצריך מימון אני שם בשבילו. בלי שום מחויבות. יש לך 10 דקות לקפה השבוע?",
  },
  {
    id: "r_gift", group: "מתווכים – המשך", title: "פנייה שנייה עם משהו בתוכה (במקום \"רק מזכיר\")",
    prep: "לצרף את מה שהבטחת בווי: הכרטיס, דוגמה לכרטיס, או הקישור לפרק.",
    body: "היי [שם], לא מציק, רק משאיר את זה כאן: [הכרטיס / דוגמה לכרטיס / קישור לפרק]. אם זה לא רלוונטי תגיד ואפסיק לכתוב 🙂",
  },
  {
    id: "after", group: "מתווכים – המשך", title: "אחרי הפגישה",
    prep: "לציין משהו מדויק שהוא סיפר בפגישה.",
    body: "היה כיף להכיר היום! נשארתי עם מה שסיפרת על [משהו שהוא אמר]. כשיש לקוח שנתקע עם מימון או צריך בדיקת היתכנות מהירה, תכתוב לי ואחזור אליך בהקדם.",
  },
  {
    id: "cpn", group: "מתווכים – המשך", title: "ההפתעה: קופון ייעוץ ללקוחות שלו",
    prep: "להכין קופון עם שמו (קנבה). לוגו שלו רק באישורו. כולל קוד אישי ותוקף.",
    body: "הכנתי לך משהו קטן: קופון לפגישת ייעוץ משכנתא בחינם, מעוצב עם השם שלך. אפשר לתת אותו לכל לקוח שמתלבט, בלי עלות ובלי התחייבות. שלח לי אם תרצה ואכין לך גם גרסה עם הלוגו.",
  },
  {
    id: "s_q", hook: true, group: "משרדי מכירות ותיווך", title: "ביקור ראשון: שאלה אחת",
    prep: "לבוא בלי הצעה, כרטיס ביקור דיגיטלי עם QR. לשאול ולהקשיב.",
    body: "היי, אני צ'יקו, יועץ משכנתאות פה ברחובות. עברתי להכיר. שאלה אחת: מתוך הלקוחות הרציניים שמגיעים אליכם, כמה נופלים בשלב אישור המשכנתא, ומה בדיוק מפיל אותם?",
  },
  {
    id: "s_desk", hook: true, group: "משרדי מכירות ותיווך", title: "שולחן יועץ משכנתאות אצלכם (שעתיים, בחינם)",
    prep: "דורש אישור של המשרד או היזם. מתאים במיוחד להשקה או לשישי בבוקר.",
    body: "היי [שם], רעיון קטן: אני יכול לשבת אצלכם שעתיים עם מחשב ולתת לרוכשים שמתלבטים בדיקת היתכנות במקום, בחינם ובלי התחייבות. הם יודעים מיד מה הם יכולים, ואתם מקצרים את הדרך לחתימה. מעניין?",
  },
  {
    id: "s_sheet", hook: true, group: "משרדי מכירות ותיווך", title: "דף ממחיש לפרויקט שלהם",
    prep: "דורש מחירון ולוח תשלומים של הפרויקט (לבקש בביקור). לא להמציא מספרים. \"הערכה בלבד\".",
    body: "היי [שם], הכנתי דף של עמוד אחד ל[שם הפרויקט]: כמה הון עצמי רוכש צריך בכל שלב תשלום, וכמה ההחזר החודשי בשלושה תרחישים. רוכשים מתלבטים אוהבים לראות את זה שחור על לבן. רוצים שאשלח? (הערכה בלבד)",
  },
  {
    id: "s_after", group: "משרדי מכירות ותיווך", title: "הודעה אחרי הביקור (אותו יום)",
    prep: "לציין את הקושי שהם הזכירו.",
    body: "היי [שם], היה נעים להכיר היום. נשארתי עם מה שסיפרתם על [הקושי שהם הזכירו]. יש לי רעיון קטן שאולי יעזור, אשמח לספר בשיחה של 10 דקות.",
  },
  {
    id: "s_follow", group: "משרדי מכירות ותיווך", title: "מעקב (שבוע–שבועיים אחרי)",
    body: "היי [שם], חשבתי שוב על [הקושי]. אם יש לקוח שמתעכב אצלכם בגלל מימון, שלחו אותו אליי ואני בודק לו היתכנות בלי התחייבות ומעדכן אתכם.",
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Hooks that can be assigned to a partner of this kind (brokers get h_*, offices and projects get s_*). */
export function hooksFor(kind: PartnerKind): MessageTemplate[] {
  return TEMPLATES.filter((t) => t.hook && t.id.startsWith(kind === "broker" ? "h_" : "s_"));
}

type TemplateContext = { kind: PartnerKind; stage: PartnerStage; hook?: string | null };

/** The template that fits this partner's current situation. */
export function suggestTemplate({ kind, stage, hook }: TemplateContext): string {
  if (kind === "broker") {
    if (stage === "warm" || stage === "cold" || stage === "quiet") return hook || "h_q";
    if (stage === "sent" || stage === "remind") return "r_gift";
    if (stage === "replied" || stage === "meeting" || stage === "coupon") return "cpn";
    if (stage === "met") return "after";
    return hook || "h_q";
  }
  if (stage === "cold" || stage === "quiet") return hook || "s_q";
  if (stage === "visited") return "s_after";
  if (stage === "replied" || stage === "meeting") return "s_desk";
  return "s_follow";
}

/** First name for [שם], from names like "אלירן אברהם – יועץ נדל"ן". */
export function firstName(name: string | null | undefined): string {
  const t = String(name ?? "").replace(/[–-].*$/, "").trim().split(/\s+/)[0];
  return t || "[שם]";
}

export function fillTemplate(body: string, name: string | null | undefined): string {
  return body.replace(/\[שם\]/g, firstName(name));
}

/** True when the text still has [bracketed] parts the sender has to personalize. */
export const hasPlaceholders = (text: string) => /\[[^\]]+\]/.test(text);

// ── Phones and links ──

const lastPhone = (p: string) => p.split("/").pop() ?? "";
export const phoneDigits = (p: string | null | undefined) => (p ? lastPhone(p).replace(/\D/g, "") : "");

/** Mobile numbers (05x) can receive WhatsApp; office lines (072, 073, 08) usually cannot. */
export const isMobilePhone = (p: string | null | undefined) => phoneDigits(p).startsWith("05");

export function partnerWhatsappLink(phone: string | null | undefined, text?: string): string | null {
  if (!isMobilePhone(phone)) return null;
  const base = whatsappLink(lastPhone(phone as string));
  return base && text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function instagramLink(handle: string | null | undefined): string | null {
  return handle && handle.startsWith("@") ? `https://instagram.com/${encodeURIComponent(handle.slice(1))}` : null;
}

// ── Validation ──

const short = (max: number) => z.string().trim().max(max);

export const partnerInputSchema = z.object({
  kind: z.enum(PARTNER_KINDS).default("broker"),
  name: short(160).min(1),
  org: short(160).optional().nullable(),
  instagram: short(80).optional().nullable(),
  phone: short(60).optional().nullable(),
  area: short(160).optional().nullable(),
  address: short(200).optional().nullable(),
  route: short(80).optional().nullable(),
  why: short(400).optional().nullable(),
  channel: short(120).optional().nullable(),
  priority: short(20).optional().nullable(),
  wave: z.enum(WAVES).optional().nullable(),
  hook: short(40).optional().nullable(),
  notes: short(4000).optional(),
  externalKey: short(160).optional().nullable(),
});

export const partnerPatchSchema = partnerInputSchema.partial().extend({
  stage: z.enum(PARTNER_STAGES).optional(),
  nextAction: short(300).optional().nullable(),
  nextAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  followDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  archived: z.boolean().optional(),
  archiveReason: short(300).optional().nullable(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One row of an import file (JSON). Used for the first load and for finds pushed by a scanner. */
export const partnerImportItemSchema = partnerInputSchema.extend({
  stage: z.enum(PARTNER_STAGES).optional(),
  nextAction: short(300).optional().nullable(),
  nextAt: isoDate.optional().nullable(),
  followDate: isoDate.optional().nullable(),
  archived: z.boolean().optional(),
  archiveReason: short(300).optional().nullable(),
  details: z.record(z.string(), z.unknown()).optional(),
  events: z
    .array(z.object({ kind: short(40), text: short(2000), at: z.string().optional() }))
    .max(200)
    .optional(),
});
export const partnerImportSchema = z.array(partnerImportItemSchema).min(1).max(300);
export type PartnerImportItem = z.infer<typeof partnerImportItemSchema>;

/**
 * Stable key so re-importing the same partner never creates a duplicate. Offices and projects
 * are keyed by name because several of them share one phone line.
 */
export function partnerExternalKey(p: { kind?: PartnerKind; instagram?: string | null; phone?: string | null; name: string }): string {
  const name = p.name.trim().toLowerCase();
  if (p.kind && p.kind !== "broker") return `nm:${p.kind}:${name}`;
  if (p.instagram && p.instagram.startsWith("@")) return `ig:${p.instagram.toLowerCase()}`;
  const d = phoneDigits(p.phone);
  return d ? `ph:${d}` : `nm:${name}`;
}
