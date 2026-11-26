import { NextResponse } from "next/server";

const ALLOWED = new Set([
  "page_view", "form_start", "form_submit", "result_view",
  "click_meeting", "click_community", "click_whatsapp",
]);
const clip = (v: unknown, n = 120) => String(v ?? "").slice(0, n);

// אירועים אנונימיים: בלי שם, טלפון או מייל. נשלחים כמו הלידים לגיליון (לשונית "אירועים").
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const event = clip(b.event, 40);
  if (!ALLOWED.has(event)) return NextResponse.json({ ok: false }, { status: 400 });
  // נשלחים לגיליון רק אחרי שהסקריפט עודכן (EVENTS_ENABLED=1), כדי לא ליצור שורות זבל בגיליון.
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url || process.env.EVENTS_ENABLED !== "1") return NextResponse.json({ ok: true });
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event", event, sessionId: clip(b.sessionId, 40),
        source: clip(b.source), medium: clip(b.medium), campaign: clip(b.campaign),
        content: clip(b.content), term: clip(b.term), referrer: clip(b.referrer), landing: clip(b.landing),
        secret: process.env.LEAD_WEBHOOK_SECRET ?? "",
      }),
      redirect: "follow",
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
