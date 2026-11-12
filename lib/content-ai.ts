import { getBriefModel } from "./rtm-brief";
import { cleanMetrics, type Metrics } from "./content";

// Reads the numbers from a screenshot of a post's performance screen (Instagram / Facebook /
// TikTok insights) and suggests what to improve. Uses Gemini, like the document analysis.

const SYSTEM_PROMPT = `
אתה מנתח צילומי מסך של ביצועי תוכן ברשתות חברתיות (תובנות / Insights) עבור יועץ משכנתאות בישראל.
קרא מהצילום רק מספרים שמופיעים בו במפורש. אל תנחש ואל תחשב מספר שלא מופיע.
החזר JSON בלבד, בפורמט:
{
  "views": number|null, "reach": number|null, "likes": number|null, "comments": number|null,
  "shares": number|null, "saves": number|null, "followers": number|null,
  "insights": string[]
}
- מספרים שלמים בלבד (1.2K = 1200). אם מספר לא מופיע בצילום: null.
- followers = עוקבים חדשים שהתוכן הביא, אם מופיע.
- insights: 2 עד 3 הצעות קצרות ומעשיות בעברית לשיפור, לפי הנתונים והקונטקסט שקיבלת (למשל פתיח, אורך, קריאה לפעולה, זמן פרסום).
  בלי הבטחות לתוצאה, בלי מספרי ריבית, ובלי ייעוץ פיננסי.
`.trim();

export interface ScreenshotContext {
  platform: string;
  format: string;
  topic?: string | null;
  caption?: string | null;
}

export interface ScreenshotReading {
  metrics: Metrics;
  insights: string[];
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned);
}

export function parseReading(text: string): ScreenshotReading {
  const parsed = extractJson(text);
  const insights = Array.isArray(parsed.insights)
    ? parsed.insights.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 5)
    : [];
  return { metrics: cleanMetrics(parsed), insights };
}

export async function readPerformanceScreenshot(
  image: Buffer,
  mimeType: string,
  ctx: ScreenshotContext
): Promise<ScreenshotReading> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("אין מפתח Gemini בסביבה (GEMINI_API_KEY).");

  const context = [
    `פלטפורמה: ${ctx.platform}`,
    `סוג תוכן: ${ctx.format}`,
    ctx.topic ? `נושא: ${ctx.topic}` : "",
    ctx.caption ? `טקסט התוכן: ${ctx.caption.slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: image.toString("base64") } },
          { text: `קרא את המספרים מהצילום והצע שיפורים.\n${context}` },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 1500 },
  });

  const TRANSIENT = new Set([429, 500, 502, 503, 504]);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getBriefModel()}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("לא התקבלה תשובה מהקריאה של הצילום.");
      return parseReading(text);
    }
    lastError = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (!TRANSIENT.has(res.status) || attempt === 3) throw new Error(lastError);
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  throw new Error(lastError);
}
