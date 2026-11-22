// צ'אט מנחה מבוסס Gemini. בלי GEMINI_API_KEY מחזיר 503 והלקוח עובר להסברים הקבועים.
const hits = new Map<string, { n: number; t: number }>();

const SYSTEM = `אתה מאמן NLP תומך בעברית, שמלווה אדם במילוי שאלון עומק לשינוי זהות והרגלים.
כללים: ענה בעברית פשוטה, עד 4 משפטים. אל תענה במקום המשתמש על השאלה. אל תמציא טענות מדעיות ואל תציג את עצמך כתחליף לטיפול.
כשמבקשים הסבר: הסבר בקצרה למה השאלה חשובה. כשמבקשים דוגמה: תן דוגמה אחת מעשית שאינה מתייחסת לפרטי המשתמש.
כשיש הקשר שהמשתמש סיפר, התייחס אליו ואל מילותיו. כשהמשתמש שואל משהו לא קשור לשאלה, החזר אותו בעדינות אליה.`;

const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

async function gemini(key: string, prompt: string, schema?: object, system = SYSTEM) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: schema ? 2000 : 800, ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}) },
    }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json();
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  return out || null;
}

const fail = (status = 502) => Response.json({ error: "upstream" }, { status });

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "x";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.t < 3_600_000) { if (++h.n > 60) return Response.json({ error: "rate" }, { status: 429 }); }
  else hits.set(ip, { n: 1, t: now });

  let b: { kind?: string; question?: string; text?: string; purpose?: string; format?: string; answer?: string; context?: string; followups?: number; items?: { id: string; label: string; text: string }[] };
  try { b = await req.json(); } catch { return Response.json({ error: "bad" }, { status: 400 }); }
  const question = String(b.question ?? "").slice(0, 400);
  const context = String(b.context ?? "").slice(0, 1500);

  /* ליטוש כל התשובות הקיימות בבקשה אחת */
  if (b.kind === "polish") {
    const items = (b.items ?? []).slice(0, 30).map((i) => ({ id: String(i.id), label: String(i.label).slice(0, 200), text: String(i.text).slice(0, 700) }));
    if (!items.length) return Response.json({ error: "bad" }, { status: 400 });
    const prompt = `לפניך שאלות ותשובות מושרשרות משיחה, וחלקן מכילות מילות מילוי, שאלות שהמשתמש שאל את המאמן, או ניסוח מסויג.
לכל פריט החזר text: תמצית נקייה בגוף ראשון, בזמן הווה, בניסוח חיובי, בלי מילות מילוי (אוקיי, נגיד, אז) ובלי תוכן שלא נאמר.
פורמט לפי השאלה: מטרה = משפט חיובי אחד. זהות = משפט אחד שמתחיל ב"אני אדם ש". ראייה/שמיעה/תחושה/ריח = משפט חווייתי קצר. הרגל = פעולה קצרה עם זמן. אחר = שורה או שתיים.
אם התשובה מכילה רק שאלה שלא נענתה, שלילית ("טעם של כישלון") או חסרת משמעות, החזר text ריק.
פריטים: ${JSON.stringify(items)}`;
    const out = await gemini(key, prompt, { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, text: { type: "STRING" } }, required: ["id", "text"] } });
    if (!out) return fail();
    try { return Response.json({ items: JSON.parse(out) }); } catch { return fail(); }
  }

  /* קריאת תשובה: שאלה או תשובה, תמצית, העמקה */
  if (b.kind === "answer") {
    const answer = String(b.answer ?? "").slice(0, 1200);
    if (!question || !answer) return Response.json({ error: "bad" }, { status: 400 });
    const used = Number(b.followups ?? 0);
    const prompt = `מטרת השאלה: ${String(b.purpose ?? "").slice(0, 400)}
פורמט נקי רצוי לתשובה: ${String(b.format ?? "תמצית של שורה או שתיים בגוף ראשון").slice(0, 200)}
השאלה: ${question}
${context ? `מה שהמשתמש כבר סיפר:\\n${context}\\n` : ""}ההודעה של המשתמש: ${answer}
העמקות שכבר נשאלו: ${used}

החזר JSON:
- intent: "question" אם ההודעה היא שאלה או הערה למאמן ולא תשובה לשאלה (למשל "זה מספיק מעמיק?" או "מה הכוונה?"), אחרת "answer".
- reply: אם intent=question, תשובה קצרה אליו שמחזירה אותו לשאלה. אחרת מחרוזת ריקה.
- clean: אם intent=answer, התמצית הנקייה של התשובה לפי הפורמט: בגוף ראשון, בלי מילות מילוי (אוקיי, נגיד, אז), בלי להוסיף תוכן שלא נאמר. אחרת ריק.
- reflect: משפט אחד שמשקף במילים שלך מה שהבנת (רק ב-answer).
- enough: true אם התשובה מספיק ספציפית ומתאימה לשאלה. אם התשובה שלילית (להפסיק, לא, כישלון), מסויגת (אולי, כאילו), לא נעימה או סותרת את מטרת השאלה (למשל ויזואליזציה של הצלחה שמתארת כישלון), enough=false. אל תעמיק כשהתשובה כבר קונקרטית ומכילה פעולה, זמן או פרט מדיד. אם כבר נשאלו שתי העמקות, enough=true.
- followup: שאלת העמקה אחת קצרה שמתאימה לתשובה בפועל, או ריק אם enough. כשיש הכללה, מחיקה או עיוות (תמיד, אף פעם, קשה מדי, זה אומר ש…), השתמש בשאלת מודל-העל.`;
    const out = await gemini(key, prompt, { type: "OBJECT", properties: { intent: { type: "STRING", enum: ["answer", "question"] }, reply: { type: "STRING" }, clean: { type: "STRING" }, reflect: { type: "STRING" }, enough: { type: "BOOLEAN" }, followup: { type: "STRING" } }, required: ["intent", "reply", "clean", "reflect", "enough", "followup"] });
    if (!out) return fail();
    try {
      const o = JSON.parse(out);
      return Response.json({ intent: o.intent === "question" ? "question" : "answer", reply: String(o.reply ?? ""), clean: String(o.clean ?? ""), reflect: String(o.reflect ?? ""), enough: !!o.enough || used >= 2, followup: String(o.followup ?? "") });
    } catch { return fail(); }
  }

  /* הסבר / דוגמה / שאלה חופשית */
  const text = String(b.text ?? "").slice(0, 600);
  const ask = b.kind === "explain" ? "הסבר לי את השאלה." : b.kind === "example" ? "תן לי דוגמה." : text;
  if (!question || !ask) return Response.json({ error: "bad" }, { status: 400 });
  const out = await gemini(key, `${context ? `מה שהמשתמש כבר סיפר:\\n${context}\\n\\n` : ""}השאלה בשאלון: ${question}\\n\\nהמשתמש: ${ask}`);
  if (!out) return fail();
  return Response.json({ text: out });
}
