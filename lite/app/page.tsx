"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { calc, DEAL_LABELS, DEAL_UI_LABELS, LINKED, LTV, PTI, TERMS, UNLINKED, type DealType } from "./calc";
import {
  CONSENT_CONTACT_TEXT, CONSENT_MARKETING_TEXT, CONTACT_PHONE_DISPLAY, WA_NUMBER,
} from "./consent";
import { getAttribution, track } from "./track";

// קישורים שצ'יקו מספק (מוגדרים ב-Vercel כמשתני סביבה, ודורשים Redeploy):
// NEXT_PUBLIC_BOOKING_URL: תשלום + קביעת מועד לפגישת האסטרטגיה
// NEXT_PUBLIC_COMMUNITY_URL: קישור הזמנה לקהילת הוואטסאפ
// NEXT_PUBLIC_MEETING_CREDIT=1: להציג שהסכום מקוזז מדמי הטיפול (רק אחרי שהוחלט)
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? "";
const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL ?? "";
const MEETING_CREDIT = process.env.NEXT_PUBLIC_MEETING_CREDIT === "1";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const ils = (n: number) => `${nf.format(Math.round(n))} ₪`;
const num = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const money = (s: string) => {
  const d = s.replace(/[^\d]/g, "");
  return d ? nf.format(Number(d)) : "";
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {hint && <span className="text-xs font-normal text-[#1A1A2E]/60">{hint}</span>}
      {children}
    </label>
  );
}
const inputCls = "rounded-lg border border-[#AFCDBF] bg-white px-3 py-3 text-base font-normal outline-none focus:border-[#2E8B57]";

type R = ReturnType<typeof calc>;
function Table({ r }: { r: R }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold">טבלת יכולת מימון - לפי תמהיל ותקופת ההלוואה</h3>
      <p className="mb-2 text-[11px] text-[#1A1A2E]/60">כל הסכומים ב-₪. בכל תא: למעלה, מודגש, ההחזר החודשי. מתחתיו, בקטן, סכום המשכנתה המקסימלית. שווי הנכס שאפשר לרכוש = סכום המשכנתה + ההון העצמי שלכם.</p>
      <table className="w-full table-fixed border-collapse text-center text-[10px]">
        <thead>
          <tr className="bg-[#2E8B57]/10">
            <th className="w-[25%] p-1 text-start">תמהיל</th>
            {TERMS.map((t) => <th key={t} className="p-1">{t} שנה</th>)}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.mix.id} className="border-b border-[#C8DDD2] align-top">
              <td className="p-1 text-start font-semibold leading-tight">{row.mix.label}</td>
              {row.cells.map((c) => (
                <td key={c.years} className="px-0.5 py-1.5">
                  <div className="whitespace-nowrap text-xs font-bold">{nf.format(Math.round(c.payment))}</div>
                  <div className="whitespace-nowrap text-[9px] text-[#1A1A2E]/60">{nf.format(Math.round(c.mortgage))}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Assumptions() {
  return (
    <details className="rounded-lg border border-[#C8DDD2] p-3 text-xs text-[#1A1A2E]/80">
      <summary className="cursor-pointer font-bold">על מה החישוב מבוסס</summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 ps-4">
        <li>
          מימון מרבי לפי סוג הנכס: דירה ראשונה ויחידה {LTV.first * 100}%, החלפת דירה {LTV.replacement * 100}%, דירה להשקעה {LTV.investment * 100}% משווי הנכס.
        </li>
        <li>שיעור החזר מקסימלי: {PTI * 100}% מההכנסה הפנויה (הכנסה נטו פחות התחייבויות חודשיות).</li>
        <li>ריביות לדוגמה: {LINKED}% במסלול צמוד מדד, {UNLINKED}% במסלול לא צמוד מדד. תקופה עד 30 שנה.</li>
        <li>החישוב לא כולל הוצאות נלוות לרכישה (מס רכישה, עורך דין, תיווך ועוד).</li>
        <li>התוצאה אינה אישור עקרוני מבנק ואינה מחליפה אותו.</li>
      </ul>
    </details>
  );
}

export default function Page() {
  const [f, setF] = useState({
    name: "", phone: "", email: "", income: "", obligations: "",
    equity: "", deal: "first" as DealType,
    consent: false, website: "",
  });
  const [stage, setStage] = useState<"form" | "result">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const started = useRef(false);

  useEffect(() => { getAttribution(); track("page_view"); }, []);

  function set(k: string, v: string | boolean) {
    if (!started.current) { started.current = true; track("form_start"); }
    setF((p) => ({ ...p, [k]: v }));
  }

  const input = { income: num(f.income), obligations: num(f.obligations), equity: num(f.equity), deal: f.deal };
  const r = calc(input);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) return setErr("נא להזין שם");
    if (!/^(\+972|0)5\d{8}$/.test(f.phone.replace(/[^\d+]/g, ""))) return setErr("מספר הטלפון לא נראה תקין (למשל 050-1234567)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("כתובת המייל לא נראית תקינה");
    if (input.income <= 0) return setErr("נא להזין הכנסה חודשית נטו");
    if (input.equity <= 0) return setErr("נא להזין הון עצמי");
    if (!f.consent) return setErr("כדי לקבל את התוצאה צריך לאשר את התיבה בתחתית הטופס");
    setBusy(true);
    const a = getAttribution();
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, phone: f.phone, email: f.email.trim(), website: f.website,
          consentContact: true, consentMarketing: true,
          income: input.income, obligations: input.obligations, equity: input.equity,
          deal: DEAL_LABELS[f.deal], maxMortgage: Math.round(r.best.mortgage),
          maxPrice: Math.round(r.best.price), monthlyPayment: Math.round(r.best.payment),
          source: a.source, medium: a.medium, campaign: a.campaign, content: a.content,
          term: a.term, referrer: a.referrer, landing: a.landing, sessionId: a.sessionId,
        }),
      });
      setSaved(res.ok);
      if (res.ok) track("form_submit");
    } catch { setSaved(false); }
    setBusy(false);
    setStage("result");
    track("result_view");
    window.scrollTo({ top: 0 });
  }

  const waLink = (text: string) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  const resultWa = waLink(
    `היי צ'יקו, אני ${f.name}. עשיתי את הבדיקה באתר:\nסוג נכס: ${DEAL_LABELS[f.deal]}\n` +
    `הון עצמי: ${ils(input.equity)}\nהכנסה נטו: ${ils(input.income)} | התחייבויות: ${ils(input.obligations)}\n` +
    `שווי נכס מקסימלי (הערכה): עד ${ils(r.best.price)}\nאשמח לדבר.`
  );
  const meetingLink = BOOKING_URL || waLink(`היי צ'יקו, אני ${f.name}. ראיתי את התוצאה באתר ואני רוצה לקבוע פגישת אסטרטגיה.`);

  return (
    <div className="flex flex-1 justify-center bg-[#F5FAF7] px-4 py-8 text-[#1A1A2E]">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tico-finance-logo.png" alt="TICO FINANCE — אדריכל המשכנתאות" className="h-14 w-auto" />
          <h1 className="text-2xl font-bold">כמה משכנתה תוכלו לקבל?</h1>
          <p className="text-sm text-[#1A1A2E]/70">שבע שאלות קצרות, והתוצאה מיד.</p>
        </header>

        {stage === "form" ? (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-5 shadow-sm">
            <Field label="שם">
              <input className={inputCls} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="טלפון">
              <input className={inputCls} type="tel" autoComplete="tel" inputMode="tel" dir="ltr" placeholder="050-1234567" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="מייל">
              <input className={inputCls} type="email" autoComplete="email" inputMode="email" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="הכנסה נטו חודשית משותפת (₪)" hint="סך הנטו של כל הלווים, אחרי מס.">
              <input className={inputCls} inputMode="numeric" value={f.income} onChange={(e) => set("income", money(e.target.value))} />
            </Field>
            <Field label="התחייבויות חודשיות קיימות (₪)" hint="החזרי הלוואות, ליסינג וכדומה. סך הכול בחודש. אם אין, אפשר להשאיר ריק.">
              <input className={inputCls} inputMode="numeric" placeholder="0" value={f.obligations} onChange={(e) => set("obligations", money(e.target.value))} />
            </Field>
            <Field label="הון עצמי (₪)" hint="הסכום שזמין לכם לרכישה, כולל כסף ממכירת דירה קיימת.">
              <input className={inputCls} inputMode="numeric" value={f.equity} onChange={(e) => set("equity", money(e.target.value))} />
            </Field>
            <Field label="סוג הנכס">
              <select className={inputCls} value={f.deal} onChange={(e) => set("deal", e.target.value)}>
                {(Object.keys(DEAL_UI_LABELS) as DealType[]).map((k) => <option key={k} value={k}>{DEAL_UI_LABELS[k]}</option>)}
              </select>
            </Field>
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} />

            <label className="flex items-start gap-2 text-xs text-[#1A1A2E]/80">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>
                {CONSENT_CONTACT_TEXT} {CONSENT_MARKETING_TEXT}{" "}
                קראתי את <Link href="/privacy" target="_blank" className="underline">מדיניות הפרטיות</Link> ואת <Link href="/terms" target="_blank" className="underline">תנאי השימוש</Link>.
              </span>
            </label>

            <p className="text-xs text-[#1A1A2E]/60">התוצאה היא הערכה בלבד ואינה המלצה או ייעוץ פרטני לאף מקרה.</p>
            {err && <p className="text-sm font-semibold text-[#C0392B]">{err}</p>}
            <button disabled={busy} className="rounded-xl bg-[#2E8B57] px-4 py-3 text-base font-bold text-white disabled:opacity-60">
              {busy ? "מחשבים..." : "חשבו"}
            </button>
          </form>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#1A1A2E]/70">{f.name}, זו ההערכה שלכם:</p>
            <div className="rounded-xl bg-[#2E8B57]/10 p-4 text-center">
              <div className="text-sm">אפשר לרכוש נכס בשווי של עד</div>
              <div className="text-3xl font-extrabold text-[#2E8B57]">{ils(r.best.price)}</div>
              <div className="text-xs text-[#1A1A2E]/70">עם משכנתה של עד {ils(r.best.mortgage)}</div>
            </div>
            <p className="rounded-lg border border-[#B8860B]/40 bg-[#B8860B]/10 p-3 text-xs font-semibold text-[#7a5a08]">
              זו הערכה בלבד. אין בה המלצה או ייעוץ פרטני לאף מקרה, והיא אינה התחייבות לאישור אשראי. התוצאה בפועל תלויה בבנק, בדוח האשראי ובבדיקה מלאה.
            </p>
            <p className="text-xs text-[#1A1A2E]/60">
              {r.limitedBy === "income"
                ? "הסכום מוגבל על ידי יכולת ההחזר מההכנסה."
                : `הסכום מוגבל על ידי אחוז המימון המותר (${r.ltvPercent}%) ביחס להון העצמי.`}
            </p>
            <Table r={r} />

            <div className="flex flex-col gap-3 rounded-xl border border-[#2E8B57]/40 bg-[#F5FAF7] p-4">
              <h2 className="text-lg font-bold">זה המספר. עכשיו צריך לדעת מה לעשות איתו.</h2>
              <p className="text-sm">
                בפגישת אסטרטגיה אישית נבנה יחד את הצעד הבא לפני שחותמים על חוזה. מה מקבלים: מסמך יכולת, בדיקת יכולת לפני חוזה, תמהיל מותאם ותוכנית פעולה.
              </p>
              <p className="text-xs text-[#1A1A2E]/70">
                עלות הפגישה: 350 ₪ + מע״מ.{MEETING_CREDIT ? " הסכום יקוזז מדמי הטיפול אם נמשיך יחד." : ""}
              </p>
              <a
                href={meetingLink}
                onClick={() => track("click_meeting")}
                className="rounded-xl bg-[#2E8B57] px-4 py-3 text-center text-base font-bold text-white"
              >
                קבעו פגישת אסטרטגיה
              </a>
              {COMMUNITY_URL && (
                <a
                  href={COMMUNITY_URL}
                  onClick={() => track("click_community")}
                  className="rounded-xl border border-[#2E8B57] px-4 py-3 text-center text-base font-bold text-[#2E8B57]"
                >
                  הצטרפו לקהילת הוואטסאפ
                </a>
              )}
              <a
                href={resultWa}
                onClick={() => track("click_whatsapp")}
                className="text-center text-sm underline"
              >
                שלחו לצ'יקו בוואטסאפ ({CONTACT_PHONE_DISPLAY})
              </a>
            </div>

            {!saved && <p className="text-xs text-[#1A1A2E]/60">אם לא תשמעו ממני תוך יום, שלחו לי בוואטסאפ ואחזור אליכם.</p>}
            <Assumptions />
          </section>
        )}
        <footer className="flex flex-col items-center gap-1 text-center text-xs text-[#1A1A2E]/50">
          <p>TICO FINANCE · אדריכל המשכנתאות</p>
          <p>
            <Link href="/privacy" className="underline">מדיניות פרטיות</Link> · <Link href="/terms" className="underline">תנאי שימוש</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
