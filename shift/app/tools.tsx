"use client";

import { useState } from "react";

const card = "rounded-2xl bg-surface border border-line p-5";
const field = "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-brand";
const btn = "rounded-xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-40 dark:text-black";

export type Tool = "sos" | "meta" | "positions" | "chunk";
export const TOOLS: [Tool, string][] = [["sos", "חירום"], ["meta", "מודל-העל"], ["positions", "עמדות"], ["chunk", "Chunking"]];

export function Tools({ answers, tool, setTool }: { answers: Record<string, string>; tool: Tool; setTool: (t: Tool) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 text-xs">
        {TOOLS.map(([k, l]) => (
          <button key={k} onClick={() => setTool(k)} className={`rounded-xl border py-2 ${tool === k ? "border-brand bg-brand/10 font-semibold" : "border-line"}`}>{l}</button>
        ))}
      </div>
      {tool === "sos" && <Sos anchor={answers.anchor} />}
      {tool === "meta" && <Meta />}
      {tool === "positions" && <Positions />}
      {tool === "chunk" && <Chunk answers={answers} />}
    </div>
  );
}

/* כפתור חירום: State Shifter */
function Sos({ anchor }: { anchor?: string }) {
  const steps = [
    `עצור. נשימה איטית אחת, והפעל את העוגן שלך: ${anchor || "(הגדר עוגן בפרופיל)"}.`,
    "דמיין את מה שמציף אותך כתמונה. הקטן אותה, הרחק אותה, הפוך אותה לשחור-לבן וטשטש את הקצוות.",
    "הקול הפנימי: שנה אותו לטון רגוע, איטי, או לקול מצחיק. שים לב איך העוצמה יורדת.",
    "מסגור מחדש: מה הנתון האסטרטגי שיש כאן, שמאפשר לי לדייק?",
    "צעד אחד: מהי הפעולה הקטנה ביותר, של 15 דקות, שאפשר לעשות עכשיו?",
  ];
  const [i, setI] = useState(0);
  return (
    <div className={card}>
      <h2 className="font-bold">כפתור חירום: שינוי מצב</h2>
      <p className="mt-1 text-sm text-muted">להצפה או דחיינות. שלב {Math.min(i + 1, steps.length)} מתוך {steps.length}.</p>
      <p className="mt-4 text-lg leading-relaxed">{i < steps.length ? steps[i] : "כל הכבוד. המצב השתנה. עכשיו ביצוע."}</p>
      <div className="mt-4 flex gap-3">
        {i < steps.length && <button className={`${btn} flex-1`} onClick={() => setI(i + 1)}>עשיתי, הלאה</button>}
        {i > 0 && <button className="rounded-xl border border-line px-5 py-3" onClick={() => setI(0)}>מההתחלה</button>}
      </div>
    </div>
  );
}

/* מודל-העל: זיהוי הכללה / מחיקה / עיוות ושאלות אתגור */
const RULES = [
  { name: "הכללה", re: /תמיד|אף פעם|לעולם|כולם|אף אחד|כל פעם|אין סיכוי|בכלל לא/, qs: ["תמיד? האם הייתה פעם אחת שבה זה היה אחרת?", "כולם / אף אחד? מי בדיוק?"] },
  { name: "מחיקה", re: /קשה|מדי|לא מספיק|לא מסוגל|אי אפשר|בלתי אפשרי|לא ילך/, qs: ["קשה ביחס למה, ספציפית?", "איזה חלק דורש פירוק? מה חסר כדי שיהיה מספיק?"] },
  { name: "עיוות", re: /אם .+ אז|זה אומר ש|גורם לי|בגלל|נכשלתי|חושב(ים)? ש/, qs: ["איזו פרשנות אלטרנטיבית ומקדמת אפשר לתת לזה?", "איך בדיוק א' גורם ל-ב'? מה היה קורה אילו לא?"] },
];
function Meta() {
  const [t, setT] = useState("");
  const hits = RULES.filter((r) => r.re.test(t));
  return (
    <div className={card}>
      <h2 className="font-bold">פירוק עיוותי חשיבה</h2>
      <p className="mt-1 text-sm text-muted">כתוב את המשפט המעכב כמו שהוא נשמע בראש.</p>
      <textarea className={`${field} mt-3 min-h-20`} value={t} onChange={(e) => setT(e.target.value)} placeholder="למשל: אני תמיד נתקע, וזה קשה מדי" />
      {t.trim() && (
        <div className="mt-4 space-y-3">
          {(hits.length ? hits : [{ name: "כללי", qs: ["מה בדיוק קורה? מי, מה, מתי?", "מה היית רוצה שיקרה במקום?"] }]).map((h) => (
            <div key={h.name} className="rounded-xl bg-brand/10 p-3 text-sm">
              <b>{h.name}</b>
              <ul className="mt-1 list-disc ps-5 leading-relaxed">{h.qs.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* עמדות תפיסה */
function Positions() {
  const P = ["עמדה 1: דרך העיניים שלי. מה אני רואה, שומע ומרגיש?", "עמדה 2: דרך עיני הצד השני (לקוח, שותף). מה הוא רואה, מרגיש וצריך?", "עמדה 3: אנליסט חיצוני נטול רגש. מה רואים מבחוץ, ומה ההמלצה?"];
  const [v, setV] = useState(["", "", ""]);
  return (
    <div className="space-y-3">
      <input className={field} placeholder="הסיטואציה או ההחלטה" aria-label="סיטואציה" />
      {P.map((p, n) => (
        <div key={p} className={card}>
          <p className="font-semibold">{p}</p>
          <textarea className={`${field} mt-2 min-h-20`} value={v[n]} onChange={(e) => setV(v.map((x, k) => (k === n ? e.target.value : x)))} />
        </div>
      ))}
    </div>
  );
}

/* Chunking up / down */
function Chunk({ answers }: { answers: Record<string, string> }) {
  const [down, setDown] = useState("");
  return (
    <div className="space-y-3">
      <div className={card}>
        <h2 className="font-bold">פירוק למטה: כשזה מציף</h2>
        <p className="mt-1 text-sm text-muted">מהו הצעד הקונקרטי היחיד, של 15 דקות, שאפשר להתחיל עכשיו?</p>
        <input className={`${field} mt-3`} value={down} onChange={(e) => setDown(e.target.value)} placeholder="הצעד הבא הוא…" />
        {down && <p className="mt-3 rounded-xl bg-accent/15 p-3 text-sm">טיימר של 15 דקות. התחל: {down}</p>}
      </div>
      <div className={card}>
        <h2 className="font-bold">עלייה למעלה: כשטובעים בפרטים</h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed">
          <li><b>הייעוד שלי:</b> {answers.purpose || "—"}</li>
          <li><b>מה חשוב לי:</b> {answers.values || "—"}</li>
          <li><b>המטרה:</b> {answers.goal || "—"}</li>
        </ul>
        <p className="mt-3 text-sm text-muted">איך הפעולה שאני עושה עכשיו משרתת את זה?</p>
      </div>
    </div>
  );
}
