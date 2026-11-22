// צ'אט מנחה מבוסס Gemini. בלי GEMINI_API_KEY מחזיר 503 והלקוח עובר להסברים הקבועים.
const hits = new Map<string, { n: number; t: number }>();

const SYSTEM = `אתה מאמן NLP תומך בעברית, שמלווה אדם במילוי שאלון עומק לשינוי זהות והרגלים.
כללים: ענה בעברית פשוטה, עד 4 משפטים. אל תענה במקום המשתמש על השאלה. אל תמציא טענות מדעיות ואל תציג את עצמך כתחליף לטיפול.
כשמבקשים הסבר: הסבר בקצרה למה השאלה חשובה. כשמבקשים דוגמה: תן דוגמה אחת מעשית שאינה מתייחסת לפרטי המשתמש.
כשהמשתמש שואל משהו לא קשור לשאלה, החזר אותו בעדינות אליה.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "x";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.t < 3_600_000) { if (++h.n > 40) return Response.json({ error: "rate" }, { status: 429 }); }
  else hits.set(ip, { n: 1, t: now });

  let body: { kind?: string; question?: string; text?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "bad" }, { status: 400 }); }
  const question = String(body.question ?? "").slice(0, 400);
  const text = String(body.text ?? "").slice(0, 600);
  const ask = body.kind === "explain" ? "הסבר לי את השאלה." : body.kind === "example" ? "תן לי דוגמה." : text;
  if (!question || !ask) return Response.json({ error: "bad" }, { status: 400 });

  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `השאלה בשאלון: ${question}\n\nהמשתמש: ${ask}` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    }),
  }).catch(() => null);
  if (!r || !r.ok) return Response.json({ error: "upstream", status: r?.status ?? 0 }, { status: 502 });
  const j = await r.json();
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!out) return Response.json({ error: "empty" }, { status: 502 });
  return Response.json({ text: out });
}
