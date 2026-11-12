import { z } from "zod";
import { addDays } from "./partners";

// Client journeys: the work processes (as defined in Smart NPV), their stages, and the update
// messages sent to the client. Smart NPV stays the place where the case is managed; this module
// only tracks where each client is, so the right update message is ready to copy and send.
// No financial details are stored here on purpose.

export type StageKey =
  | "sale"
  | "sale_refi"
  | "docs"
  | "submission"
  | "pricing"
  | "collateral_ramy"
  | "collateral_tabu"
  | "collateral_contractor"
  | "signing"
  | "execution_external"
  | "execution_internal"
  | "final";

export interface StageDef {
  key: StageKey;
  label: string;
  /** Planned length in days, used for the default stage due date (editable per client). */
  days: number;
}

const S: Record<StageKey, StageDef> = {
  sale: { key: "sale", label: "תהליך מכירה", days: 5 },
  sale_refi: { key: "sale_refi", label: "תהליך מכירה – מחזור", days: 3 },
  docs: { key: "docs", label: "איסוף מסמכי הגשה", days: 10 },
  submission: { key: "submission", label: "תהליך הגשה", days: 7 },
  pricing: { key: "pricing", label: "בניית תמחיל ומו\"מ", days: 14 },
  collateral_ramy: { key: "collateral_ramy", label: "בטחונות – רמ\"י", days: 10 },
  collateral_tabu: { key: "collateral_tabu", label: "בטחונות – טאבו", days: 10 },
  collateral_contractor: { key: "collateral_contractor", label: "בטחונות – רכישה מקבלן עם ליווי", days: 12 },
  signing: { key: "signing", label: "חתימות", days: 3 },
  execution_external: { key: "execution_external", label: "ביצוע – מחזור חיצוני", days: 5 },
  execution_internal: { key: "execution_internal", label: "ביצוע – מחזור פנימי", days: 2 },
  final: { key: "final", label: "חתימות, בחינה וביצוע", days: 4 },
};

export const PROCESS_KEYS = [
  "second_hand_ramy",
  "second_hand_tabu",
  "reverse",
  "contractor",
  "renovation",
  "refi_external",
  "refi_internal",
  "approval",
] as const;
export type ProcessKey = (typeof PROCESS_KEYS)[number];

export interface ProcessDef {
  key: ProcessKey;
  label: string;
  stages: StageDef[];
}

const core = [S.sale, S.docs, S.submission, S.pricing];
const refiCore = [S.sale_refi, S.docs, S.submission, S.pricing];

export const PROCESSES: Record<ProcessKey, ProcessDef> = {
  second_hand_ramy: { key: "second_hand_ramy", label: "יד שנייה עם בטחונות (רמ\"י)", stages: [...core, S.collateral_ramy, S.final] },
  second_hand_tabu: { key: "second_hand_tabu", label: "יד שנייה עם בטחונות (טאבו)", stages: [...core, S.collateral_tabu, S.final] },
  reverse: { key: "reverse", label: "משכנתה הפוכה", stages: [...core, S.collateral_tabu, S.final] },
  contractor: { key: "contractor", label: "רכישה מקבלן כולל בטחונות", stages: [...core, S.collateral_contractor, S.final] },
  renovation: { key: "renovation", label: "שיפוצים ללא ביטחונות", stages: [...core, S.signing] },
  refi_external: { key: "refi_external", label: "מחזור חיצוני", stages: [...refiCore, S.execution_external] },
  refi_internal: { key: "refi_internal", label: "מחזור פנימי", stages: [...refiCore, S.execution_internal] },
  approval: { key: "approval", label: "קבלת אישור עקרוני", stages: [S.sale, S.docs, S.submission] },
};

export const CLIENT_STATUSES = ["active", "completed", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "פעיל",
  completed: "הושלם",
  archived: "בארכיון",
};

export const processOf = (key: string): ProcessDef => PROCESSES[key as ProcessKey] ?? PROCESSES.second_hand_tabu;

export function stageOf(process: string, index: number): StageDef | null {
  const p = processOf(process);
  return p.stages[index] ?? null;
}

// ── Journey rules ──

export interface StageStart {
  stageIndex: number;
  stageStartedAt: string;
  stageDueAt: string;
}

export function startStage(process: string, index: number, today: string): StageStart | null {
  const st = stageOf(process, index);
  if (!st) return null;
  return { stageIndex: index, stageStartedAt: today, stageDueAt: addDays(today, st.days) };
}

export interface AdvanceResult {
  completed: boolean;
  /** New stage values when the journey continues. */
  next?: StageStart;
  /** Message key to send the client now: the entry message of the next stage, or the completion message. */
  pendingMessage: string;
  eventText: string;
}

export function advanceStage(process: string, index: number, today: string): AdvanceResult {
  const p = processOf(process);
  const done = p.stages[index];
  const isLast = index >= p.stages.length - 1;
  if (isLast) {
    return {
      completed: true,
      pendingMessage: p.key === "approval" ? "done:approval" : "done",
      eventText: `${done?.label ?? "שלב"} הושלם. התהליך הושלם`,
    };
  }
  const next = startStage(process, index + 1, today) as StageStart;
  const nextDef = p.stages[index + 1];
  return {
    completed: false,
    next,
    pendingMessage: `enter:${nextDef.key}`,
    eventText: `${done?.label ?? "שלב"} הושלם. עוברים ל${nextDef.label}`,
  };
}

/** Days past the stage due date (0 when not late, negative never). */
export function daysLate(stageDueAt: string | null, today: string): number {
  if (!stageDueAt) return 0;
  const d = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${stageDueAt}T12:00:00Z`)) / 86_400_000);
  return d > 0 ? d : 0;
}

// ── Update messages (copy and send manually) ──

export interface ClientMessage {
  key: string;
  title: string;
  /** What to fill in before sending. */
  prep?: string;
  body: string;
}

const enter = (key: StageKey, title: string, body: string, prep?: string): ClientMessage => ({ key: `enter:${key}`, title, body, prep });

export const STAGE_MESSAGES: ClientMessage[] = [
  enter("sale", "ברוך הבא: מתחילים", "היי [שם], שמח שאנחנו יוצאים לדרך. השלב הראשון הוא בדיקת היתכנות ופגישת ייעוץ, כדי שנבין יחד מה נכון לך. אעדכן אותך ברגע שיש תאריך לפגישה."),
  enter("sale_refi", "ברוך הבא: מחזור", "היי [שם], שמח שאנחנו יוצאים לדרך. כדי לבדוק את המחזור אצטרך ממך דו\"ח יתרות מהבנק הנוכחי. אעביר לך בדיוק איך מקבלים אותו, ואחר כך נבדוק יחד מה אפשר לעשות."),
  enter("docs", "איסוף מסמכים", "היי [שם], תודה על ההחלטה לצאת איתי לדרך 🙏 הסכם הייעוץ חתום ואנחנו רשמית מתחילים. שלחתי לך רשימת מסמכים להגשה. אפשר להתחיל מהקלים ולשלוח בהדרגה, ואני אסמן מה התקבל ומה חסר. ככל שהמסמכים מגיעים מהר יותר, אנחנו מתקדמים מהר יותר."),
  enter("submission", "הגשה לבנקים", "היי [שם], התיק מוכן ואני מגיש אותו לבנקים. בימים הקרובים ייתכנו שאלות או בקשות להשלמה, ואעדכן אותך על כל התקדמות. אין צורך לעשות כלום כרגע."),
  enter("pricing", "תמחיל ומו\"מ", "היי [שם], מתחיל השלב שבו אני מנהל מו\"מ מול הבנקים על התנאים ובונה לך את התמחיל המתאים. נשב לפגישה כדי לעבור על האפשרויות ולהחליט יחד."),
  enter("collateral_ramy", "בטחונות – רמ\"י", "היי [שם], עוברים לשלב הבטחונות. כאן יהיו: שמאי מטעם הבנק, רישום משכון, ביטוחי חיים ונכס, ועו\"ד נוטריון. אתאם הכול ואעדכן אותך מה נדרש ממך ומתי."),
  enter("collateral_tabu", "בטחונות – טאבו", "היי [שם], עוברים לשלב הבטחונות. כאן יהיו: שמאי מטעם הבנק, שטרי משכנתא, אישור עירייה, רישום משכון, ביטוחי חיים ונכס, ועו\"ד נוטריון. אתאם הכול ואעדכן אותך מה נדרש ממך ומתי."),
  enter("collateral_contractor", "בטחונות – רכישה מקבלן", "היי [שם], עוברים לשלב הבטחונות מול הקבלן: התחייבות הקבלן, קבלת הב\"ח, העברת מסמכי המוכרים ורישום הערת אזהרה. אני מתאם הכול ואעדכן אותך מה נדרש ממך ומתי."),
  enter("signing", "חתימות", "היי [שם], מתקרבים לסיום. נקבע פגישת חתימות ואעביר לך סיכום והנחיות להמשך. אעדכן אותך ברגע שיש תאריך."),
  enter("execution_external", "ביצוע – מחזור חיצוני", "היי [שם], עוברים לביצוע המחזור: חתימה בבנק, ביטוחים ועו\"ד נוטריון לפי הצורך. אעדכן אותך מה נדרש ממך ומתי."),
  enter("execution_internal", "ביצוע – מחזור פנימי", "היי [שם], עוברים לביצוע המחזור בבנק הנוכחי. אעדכן אותך מה נדרש ממך ומתי, וברגע שיש ביצוע אודיע לך."),
  enter("final", "חתימות, בחינה וביצוע", "היי [שם], קבענו חתימות ב[בנק] ב[תאריך]. אחרי החתימה הבנק עושה בחינה אחרונה ואחר כך מתבצע המימון. אעדכן אותך ברגע שיש ביצוע.", "להשלים בנק ותאריך."),
  { key: "done", title: "התהליך הושלם", body: "מזל טוב [שם]! התהליך הושלם 🎉 תודה על האמון. אני כאן לכל שאלה בהמשך, ואם יש מישהו קרוב שצריך ליווי, אשמח להכיר." },
  { key: "done:approval", title: "אישור עקרוני התקבל", body: "היי [שם], קיבלתי מהבנקאי אישור עקרוני. זה אישור ראשוני בכפוף להמשך התהליך ולבדיקות הבנק. כשתרצה להתקדם, נמשיך יחד לשלב הבא.", prep: "להשלים את שם הבנק אם רלוונטי." },
];

export interface Milestone {
  key: string;
  label: string;
  stages: StageKey[];
  message: ClientMessage;
}

const ms = (key: string, label: string, stages: StageKey[], body: string, prep?: string): Milestone => ({
  key,
  label,
  stages,
  message: { key: `milestone:${key}`, title: label, body, prep },
});

export const MILESTONES: Milestone[] = [
  ms("docs_missing", "רשימת חוסרים", ["docs"], "היי [שם], תודה על המסמכים! נשארו כמה פריטים להשלמה: [רשימה]. ברגע שיגיעו אסגור את התיק.", "להשלים את רשימת החוסרים."),
  ms("banker_ok", "אישור מהבנקאי", ["submission"], "היי [שם], קיבלתי מ[בנק] התייחסות חיובית ראשונית. זה אישור עקרוני בכפוף להמשך הבדיקה של הבנק, ואמשיך לעדכן.", "להשלים את שם הבנק."),
  ms("rate_ok", "אישור ריבית בבנק", ["pricing"], "היי [שם], הבנק עדכן אותי שאישר את התנאים שסוכמו. השלב הבא: [השלב הבא]. אעדכן אותך מה נדרש."),
  ms("pricing_closed", "סגרנו תמחיל סופי", ["pricing"], "היי [שם], סגרנו יחד תמחיל סופי ואת הבנק. השלב הבא: [השלב הבא]. אעדכן אותך מתי נקבעות החתימות."),
  ms("appraiser_visit", "תיאום ביקור שמאי", ["collateral_ramy", "collateral_tabu", "collateral_contractor"], "היי [שם], השמאי מתאם ביקור ב[תאריך]. חשוב שיהיה מישהו בנכס.", "להשלים תאריך."),
  ms("insurance", "ביטוחים", ["collateral_ramy", "collateral_tabu", "collateral_contractor", "execution_external", "execution_internal"], "היי [שם], צריך לסגור ביטוח חיים וביטוח נכס. אעביר לך את הפרטים וההפניות."),
  ms("signing_set", "קביעת חתימות", ["signing", "final"], "היי [שם], קבענו חתימות ב[בנק] ב[תאריך]. כדאי להביא: [מסמכים].", "להשלים בנק, תאריך ומסמכים."),
];

export const milestonesFor = (stage: StageKey | undefined) => (stage ? MILESTONES.filter((m) => m.stages.includes(stage)) : []);
export const milestoneByKey = (key: string) => MILESTONES.find((m) => m.key === key);

/** Every message the client can be sent, by key (`enter:docs`, `done`, `milestone:rate_ok`, ...). */
export function messageByKey(key: string): ClientMessage | undefined {
  return STAGE_MESSAGES.find((m) => m.key === key) ?? MILESTONES.find((m) => m.message.key === key)?.message;
}

export const ALL_MESSAGES: ClientMessage[] = [...STAGE_MESSAGES, ...MILESTONES.map((m) => m.message)];

/** The message to prepare for a client right now: the pending one, otherwise the current stage's entry message. */
export function currentMessageKey(client: { process: string; stageIndex: number; pendingMessage: string | null; status: string }): string {
  if (client.pendingMessage) return client.pendingMessage;
  if (client.status === "completed") return "done";
  const st = stageOf(client.process, client.stageIndex);
  return st ? `enter:${st.key}` : "done";
}

// ── Validation ──

const short = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const clientInputSchema = z.object({
  name: short(160).min(1),
  phone: short(60).optional().nullable(),
  process: z.enum(PROCESS_KEYS),
  leadId: z.string().uuid().optional().nullable(),
  notes: short(2000).optional(),
});

export const clientPatchSchema = z.object({
  name: short(160).min(1).optional(),
  phone: short(60).optional().nullable(),
  process: z.enum(PROCESS_KEYS).optional(),
  stageIndex: z.number().int().min(0).max(20).optional(),
  stageDueAt: isoDate.optional().nullable(),
  status: z.enum(CLIENT_STATUSES).optional(),
  notes: short(2000).optional(),
});
