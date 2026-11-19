"use client";
import { useState } from "react";
import { calc, DEAL_LABELS, TERMS, type DealType } from "./calc";

const WA = "972507700322";
const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const ils = (n: number) => `${nf.format(Math.round(n))} ₪`;
const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
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
      <p className="mb-2 text-[11px] text-[#1A1A2E]/60">בכל תא: סכום המשכנתה, ומתחתיו ההחזר החודשי. שווי הנכס שאפשר לרכוש = סכום המשכנתה + ההון העצמי שלך.</p>
      <table className="w-full border-collapse text-center text-[11px]">
        <thead>
          <tr className="bg-[#2E8B57]/10">
            <th className="w-[30%] p-1.5 text-start">תמהיל</th>
            {TERMS.map((t) => <th key={t} className="p-1.5">{t} שנה</th>)}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.mix.id} className="border-b border-[#C8DDD2] align-top">
              <td className="p-1.5 text-start font-semibold">{row.mix.label}</td>
              {row.cells.map((c) => (
                <td key={c.years} className="p-1.5">
                  <div className="whitespace-nowrap text-xs font-bold">{nf.format(Math.round(c.mortgage))} ₪</div>
                  <div className="whitespace-nowrap text-[10px] text-[#1A1A2E]/60">{nf.format(Math.round(c.payment))} / חודש</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  const [f, setF] = useState({
    name: "", phone: "", email: "", income: "", obligations: "",
    equity: "", deal: "first" as DealType, consent: false, website: "",
  });
  const [stage, setStage] = useState<"form" | "result">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

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
    if (!f.consent) return setErr("צריך לאשר את שליחת הפרטים כדי לקבל את התוצאה");
    setBusy(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, phone: f.phone, email: f.email.trim(), consent: true, website: f.website,
          income: input.income, obligations: input.obligations, equity: input.equity,
          deal: DEAL_LABELS[f.deal], maxMortgage: Math.round(r.best.mortgage),
          maxPrice: Math.round(r.best.price), monthlyPayment: Math.round(r.best.payment),
          createdAt: new Date().toISOString(),
        }),
      });
      setSaved(res.ok);
    } catch { setSaved(false); }
    setBusy(false);
    setStage("result");
  }

  const waText = encodeURIComponent(
    `היי צ'יקו, אני ${f.name}. עשיתי את הבדיקה באתר:\nסוג נכס: ${DEAL_LABELS[f.deal]}\n` +
    `הון עצמי: ${ils(input.equity)}\nהכנסה נטו: ${ils(input.income)} | התחייבויות: ${ils(input.obligations)}\n` +
    `משכנתה אפשרית (הערכה): עד ${ils(r.best.mortgage)}\nאשמח לדבר.`
  );

  return (
    <div className="flex flex-1 justify-center bg-[#F5FAF7] px-4 py-8 text-[#1A1A2E]">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tico-finance-logo.png" alt="TICO FINANCE — אדריכל המשכנתאות" className="h-14 w-auto" />
          <h1 className="text-2xl font-bold">כמה משכנתה תוכל לקבל?</h1>
          <p className="text-sm text-[#1A1A2E]/70">שבע שאלות קצרות, והתוצאה מיד.</p>
        </header>

        {stage === "form" ? (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-5 shadow-sm">
            <Field label="שם">
              <input className={inputCls} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="טלפון">
              <input className={inputCls} type="tel" autoComplete="tel" inputMode="tel" dir="ltr" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="מייל">
              <input className={inputCls} type="email" autoComplete="email" inputMode="email" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="הכנסה נטו חודשית משותפת (₪)">
              <input className={inputCls} inputMode="numeric" value={f.income} onChange={(e) => set("income", e.target.value)} />
            </Field>
            <Field label="התחייבויות חודשיות קיימות - הלוואות, ליסינג (₪)">
              <input className={inputCls} inputMode="numeric" placeholder="0" value={f.obligations} onChange={(e) => set("obligations", e.target.value)} />
            </Field>
            <Field label="הון עצמי (₪)">
              <input className={inputCls} inputMode="numeric" value={f.equity} onChange={(e) => set("equity", e.target.value)} />
            </Field>
            <Field label="סוג הנכס">
              <select className={inputCls} value={f.deal} onChange={(e) => set("deal", e.target.value)}>
                {Object.entries(DEAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} />
            <label className="flex items-start gap-2 text-xs text-[#1A1A2E]/80">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              אני מאשר/ת את שליחת הפרטים לצ'יקו פייננס וליצירת קשר איתי בטלפון, בוואטסאפ או במייל.
            </label>
            <p className="text-xs text-[#1A1A2E]/60">התוצאה היא הערכה בלבד ואינה המלצה או ייעוץ פרטני לאף מקרה.</p>
            {err && <p className="text-sm font-semibold text-[#C0392B]">{err}</p>}
            <button disabled={busy} className="rounded-xl bg-[#2E8B57] px-4 py-3 text-base font-bold text-white disabled:opacity-60">
              {busy ? "מחשב..." : "חשב"}
            </button>
          </form>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#1A1A2E]/70">{f.name}, זו ההערכה שלך:</p>
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
            <a href={`https://wa.me/${WA}?text=${waText}`} className="rounded-xl bg-[#25D366] px-4 py-3 text-center text-base font-bold text-white">
              שלח לצ'יקו בוואטסאפ
            </a>
            <a href="tel:0507700322" className="text-center text-sm underline">או התקשר: 050-7700322</a>
            {!saved && <p className="text-xs text-[#1A1A2E]/60">אם לא תשמע ממני תוך יום, שלח לי בוואטסאפ ואחזור אליך.</p>}
          </section>
        )}
        <p className="text-center text-xs text-[#1A1A2E]/50">TICO FINANCE · אדריכל המשכנתאות</p>
      </main>
    </div>
  );
}
