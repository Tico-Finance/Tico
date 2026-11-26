import { NextResponse } from "next/server";
import { CONSENT_CONTACT_TEXT, CONSENT_MARKETING_TEXT, CONSENT_VERSION } from "../../consent";

const clip = (v: unknown, n = 120) => String(v ?? "").slice(0, n);
const numv = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const phone = clip(b.phone, 20).replace(/[^\d+]/g, "");
  const name = clip(b.name, 80).trim();
  const email = clip(b.email).trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^(\+972|0)5\d{8}$/.test(phone) || b.consentContact !== true)
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lead",
        name, phone, email,
        income: numv(b.income), obligations: numv(b.obligations), equity: numv(b.equity),
        deal: clip(b.deal, 40), maxMortgage: numv(b.maxMortgage), maxPrice: numv(b.maxPrice),
        monthlyPayment: numv(b.monthlyPayment),
        consent: true, // תאימות לסקריפט הישן
        consentContact: true, consentMarketing: b.consentMarketing === true,
        consentVersion: CONSENT_VERSION,
        consentContactText: CONSENT_CONTACT_TEXT, consentMarketingText: CONSENT_MARKETING_TEXT,
        source: clip(b.source), medium: clip(b.medium), campaign: clip(b.campaign),
        content: clip(b.content), term: clip(b.term), referrer: clip(b.referrer),
        landing: clip(b.landing), sessionId: clip(b.sessionId, 40),
        secret: process.env.LEAD_WEBHOOK_SECRET ?? "",
      }),
      redirect: "follow",
    });
    return NextResponse.json({ ok: r.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
