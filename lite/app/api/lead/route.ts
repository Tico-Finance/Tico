import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  const phone = String(b.phone ?? "").replace(/[^\d+]/g, "");
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().slice(0, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^(\+972|0)5\d{8}$/.test(phone) || b.consent !== true)
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...b, name, phone, email, secret: process.env.LEAD_WEBHOOK_SECRET ?? "" }),
      redirect: "follow",
    });
    return NextResponse.json({ ok: r.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
