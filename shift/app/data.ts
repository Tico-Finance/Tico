export type Question = { id: string; label: string; hint?: string; placeholder?: string; short?: boolean };
export type Section = { id: string; title: string; intro: string; questions: Question[] };

// שלב א' במפת הדרכים: אבחון עומק (WFO, רמות לוגיות, מחסומים) + הבסיס להרגלים ולעוגן.
export const SECTIONS: Section[] = [
  {
    id: "wfo",
    title: "הגדרת המטרה (WFO)",
    intro: "מטרה בנויה היטב היא חיובית, חווייתית, תלויה בך ובטוחה לך. נבנה אותה שלב אחר שלב.",
    questions: [
      { id: "name", label: "איך קוראים לך?", short: true, placeholder: "השם שהאפליקציה תקרא לך בו" },
      { id: "goal", label: "מה בדיוק אתה רוצה?", hint: "במקום ממה אתה בורח או מה אתה מנסה למנוע.", placeholder: "המטרה שלי היא…" },
      { id: "see", label: "כשתשיג את המטרה, מה בדיוק תראה סביבך?", hint: "ראייה (V)", placeholder: "אני רואה…" },
      { id: "hear", label: "אילו קולות ומילים תשמע, מבחוץ ומבפנים?", hint: "שמיעה (A)", placeholder: "אני שומע…" },
      { id: "feel", label: "איזו תחושה גופנית ספציפית תהיה לך באותו רגע?", hint: "תחושה (K)", placeholder: "אני מרגיש ב…" },
      { id: "context", label: "מתי, איפה ועם מי אתה רוצה את המטרה הזו? ומתי לא?", placeholder: "הקשר וגבולות" },
      { id: "ecology", label: "איך ההגעה ליעד תשפיע על המשפחה, הזוגיות, העסק והבריאות? יש מחיר שאינך מוכן לשלם?", hint: "אקולוגיה", placeholder: "השפעה ומחיר" },
      { id: "control", label: "האם השגת המטרה תלויה במאה אחוז בך ובפעולות שלך? אם לא, מה בשליטתך?", placeholder: "החלק שבשליטתי הוא…" },
    ],
  },
  {
    id: "dilts",
    title: "רמות לוגיות (דילטס)",
    intro: "ממפים את שש הרמות המנטליות כדי לראות איפה התקיעות האמיתית.",
    questions: [
      { id: "purpose", label: "ייעוד וחזון: למה המטרה הזו גדולה ממך?", placeholder: "למי ולמה זה משרת?" },
      { id: "identity", label: "זהות: מי אתה צריך להיות כדי לחיות ככה?", hint: "נסח משפט שמתחיל ב\"אני אדם ש…\"", placeholder: "אני אדם ש…" },
      { id: "values", label: "ערכים ואמונות: מה חשוב לך בזה, ואילו אמונות מחזקות יש לך?", placeholder: "חשוב לי… אני מאמין ש…" },
      { id: "capabilities", label: "יכולות: אילו מיומנויות או מודלים מנטליים חסרים לך כרגע?", placeholder: "מה אני צריך ללמוד או לחזק" },
      { id: "behavior", label: "התנהגות: מהן הפעולות היומיומיות הנדרשות?", placeholder: "כל יום אני…" },
      { id: "environment", label: "סביבה: איזה מרחב ואילו אנשים יתמכו בשינוי?", placeholder: "אנשים, מקום, כלים" },
    ],
  },
  {
    id: "blocks",
    title: "מחסומים ואמונות מגבילות",
    intro: "כאן החפירה העמוקה. אין תשובה נכונה, רק כנות.",
    questions: [
      { id: "story", label: "מה הסיפור שאתה מספר לעצמך על למה עדיין לא הגעת לשם?", placeholder: "הסיפור שלי הוא…" },
      { id: "gain", label: "מה הדבר הטוב שאתה מרוויח, או איזה סיכון אתה מונע, מלהישאר במצב הנוכחי?", hint: "רווח משני", placeholder: "אני מרוויח…" },
      { id: "parts", label: "איזה חלק בך רוצה להתקדם, ואיזה חלק רוצה שקט וביטחון? מה כל חלק מבקש?", hint: "קונפליקט פנימי", placeholder: "חלק אחד… חלק שני…" },
      { id: "reframe", label: "נסח את האמונה המעצימה ההפוכה לסיפור שלך.", hint: "מסגור מחדש: מה אמת אחרת, שמשרתת אותך, על אותה סיטואציה?", placeholder: "במקום זה, אני בוחר להאמין ש…" },
    ],
  },
  {
    id: "setup",
    title: "הרגלי ליבה ועוגן",
    intro: "מהזהות גוזרים 2–3 הרגלים יומיים ועוגן למצב משאבי.",
    questions: [
      { id: "habit1", label: "הרגל ליבה 1 שנגזר מהזהות", short: true, placeholder: "למשל: 20 דקות עבודה עמוקה בבוקר" },
      { id: "habit2", label: "הרגל ליבה 2", short: true, placeholder: "למשל: תנועה גופנית" },
      { id: "habit3", label: "הרגל ליבה 3 (לא חובה)", short: true, placeholder: "אופציונלי" },
      { id: "anchor", label: "בחר עוגן למצב המשאבי שלך (פוקוס, ביטחון, רוגע): מחווה או מילה.", hint: "למשל: לחיצת אגודל ואצבע יחד ונשימה עמוקה.", placeholder: "העוגן שלי הוא…" },
    ],
  },
];

export const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);
export const REQUIRED = new Set(["name", "goal", "identity", "habit1"]);

export type Phase = "morning" | "midday" | "evening";
