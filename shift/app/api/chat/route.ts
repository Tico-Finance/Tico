// צ'אט מנחה מבוסס Gemini. בלי GEMINI_API_KEY מחזיר 503 והלקוח עובר להסברים הקבועים.
const hits = new Map<string, { n: number; t: number }>();

const SYSTEM = `אתה מאמן NLP תומך בעברית, שמלווה אדם במילוי שאלון עומק לשינוי זהות והרגלים.
כללים: ענה בעברית פשוטה, עד 4 משפטים. אל תענה במקום המשתמש על השאלה. אל תמציא טענות מדעיות ואל תציג את עצמך כתחליף לטיפול.
כשמבקשים הסבר: הסבר בקצרה למה השאלה חשובה. כשמבקשים דוגמה: תן דוגמה אחת מעשית שאינה מתייחסת לפרטי המשתמש.
כשיש הקשר שהמשתמש סיפר, התייחס אליו ואל מילותיו. כשהמשתמש שואל משהו לא קשור לשאלה, החזר אותו בעדינות אליה.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "x";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.t < 3_600_000) { if (++h.n > 40) return Response.json({ error: "rate" }, { status: 429 }); }
  else hits.set(ip, { n: 1, t: now });

  let body: { kind?: string; question?: string; text?: string; purpose?: string; answer?: string; context?: string; followups?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "bad" }, { status: 400 }); }
  const question = String(body.question ?? "").slice(0, 400);
  const text = String(body.text ?? "").slice(0, 600);
  const context = String(body.context ?? "").slice(0, 1500);

  if (body.kind === "answer") {
    const answer = String(body.answer ?? "").slice(0, 1200);
    if (!question || !answer) return Response.json({ error: "bad" }, { status: 400 });
    const used = Number(body.followups ?? 0);
    const prompt = `מטרת השאלה: ${String(body.purpose ?? "").slice(0, 400)}
השאלה: ${question}
${context ? `מה שהמשתמש כבר סיפר:\n${context}\n` : ""}התשובה של המשתמש: ${answer}
העמקות שכבר נשאלו: ${used}

החזר JSON עם: reflect (משפט אחד שמשקף במילים שלך מה שהבנת מהתשובה, בלי לשבח יתר על המידה), enough (true אם התשובה מספיק ספציפית וחווייתית כדי להמשיך, אחרת false), followup (שאלת העמקה קצרה אחת בעברית שמתאימה לתשובה בפועל, או מחרוזת ריקה אם enough). אם התשובה מכילה הכללה, מחיקה או עיוות (תמיד, אף פעם, קשה מדי, זה אומר ש…), השתמש בשאלת מודל-העל. אם כבר נשאלו שתי העמקות, החזר enough=true. אל תעמיק כשהתשובה כבר קונקרטית ומכילה פעולה, זמן או פרט מדיד: במקרה כזה enough=true וה-reflect בלבד. העמק רק כשהתשובה כללית, שלילית (\"להפסיק ל…\"), או חסרת פרטים חווייתיים.`;
    const m = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
    const rr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5, maxOutputTokens: 600, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { reflect: { type: "STRING" }, enough: { type: "BOOLEAN" }, followup: { type: "STRING" } }, required: ["reflect", "enough", "followup"] },
        },
      }),
    }).catch(() => null);
    if (!rr || !rr.ok) return Response.json({ error: "upstream", status: rr?.status ?? 0 }, { status: 502 });
    try {
      const jj = await rr.json();
      const raw = (jj.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
      const o = JSON.parse(raw);
      return Response.json({ reflect: String(o.reflect ?? ""), enough: !!o.enough || used >= 2, followup: String(o.followup ?? "") });
    } catch { return Response.json({ error: "parse" }, { status: 502 }); }
  }

  const ask = body.kind === "explain" ? "הסבר לי את השאלה." : body.kind === "example" ? "תן לי דוגמה." : text;
  if (!question || !ask) return Response.json({ error: "bad" }, { status: 400 });

  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `${context ? `מה שהמשתמש כבר סיפר:\n${context}\n\n` : ""}השאלה בשאלון: ${question}\n\nהמשתמש: ${ask}` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    }),
  }).catch(() => null);
  if (!r || !r.ok) return Response.json({ error: "upstream", status: r?.status ?? 0 }, { status: 502 });
  const j = await r.json();
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!out) return Response.json({ error: "empty" }, { status: 502 });
  return Response.json({ text: out });
}
