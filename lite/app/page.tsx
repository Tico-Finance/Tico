"use client";
import { useState } from "react";
import { calc, DEAL_LABELS, type DealType } from "./calc";

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

export default function Page() {
  const [f, setF] = useState({
    name: "", phone: "", age: "35", income: "", obligations: "0",
    propertyValue: "", equity: "", deal: "first" as DealType,
    consent: false, website: "",
  });
  const [stage, setStage] = useState<"form" | "result">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const input = {
    age: num(f.age), income: num(f.income), obligations: num(f.obligations),
    propertyValue: num(f.propertyValue), equity: num(f.equity), deal: f.deal,
  };
  const r = calc(input);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) return setErr("נשמח לדעת איך קוראים לך");
    if (!/^(\+972|0)5\d{8}$/.test(f.phone.replace(/[^\d+]/g, ""))) return setErr("מספר הטלפון לא נראה תקין (למשל 050-1234567)");
    if (input.age < 18 || input.age > 80) return setErr("נא להזין גיל תקין");
    if (input.income <= 0 || input.propertyValue <= 0) return setErr("נא להזין הכנסה ושווי נכס");
    if (!f.consent) return setErr("צריך לאשר יצירת קשר כדי לקבל את התוצאה");
    setBusy(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, phone: f.phone, consent: true, website: f.website,
          age: input.age, income: input.income, obligations: input.obligations,
          propertyValue: input.propertyValue, equity: input.equity,
          deal: DEAL_LABELS[f.deal], maxMortgage: Math.round(r.maxMortgage),
          neededMortgage: Math.round(r.needed), monthlyPayment: Math.round(r.payment),
          realistic: r.enough ? "כן" : "לא", createdAt: new Date().toISOString(),
        }),
      });
      setSaved(res.ok);
    } catch { setSaved(false); }
    setBusy(false);
    setStage("result");
  }

  const waText = encodeURIComponent(
    `היי צ'יקו, אני ${f.name}. עשיתי את הבדיקה באתר:\n` +
    `סוג עסקה: ${DEAL_LABELS[f.deal]}\nשווי נכס: ${ils(input.propertyValue)}\nהון עצמי: ${ils(input.equity)}\n` +
    `הכנסה נטו: ${ils(input.income)} | התחייבויות: ${ils(input.obligations)}\n` +
    `משכנתה אפשרית (הערכה): עד ${ils(r.maxMortgage)}\nאשמח לדבר.`
  );

  return (
    <div className="flex flex-1 justify-center bg-[#F5FAF7] px-4 py-8 text-[#1A1A2E]">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tico-finance-logo.png" alt="TICO FINANCE — אדריכל המשכנתאות" className="h-14 w-auto" />
          <h1 className="text-2xl font-bold">כמה משכנתה מתאימה לך?</h1>
          <p className="text-sm text-[#1A1A2E]/70">בדיקה מהירה בדקה אחת. אחרי השארת הפרטים תראה את התוצאה מיד.</p>
        </header>

        {stage === "form" ? (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-5 shadow-sm">
            <Field label="סוג העסקה">
              <select className={inputCls} value={f.deal} onChange={(e) => set("deal", e.target.value)}>
                {Object.entries(DEAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="שווי הנכס שאתה מתכנן לקנות (₪)">
              <input className={inputCls} inputMode="numeric" value={f.propertyValue} onChange={(e) => set("propertyValue", e.target.value)} />
            </Field>
            <Field label="הון עצמי זמין (₪)">
              <input className={inputCls} inputMode="numeric" value={f.equity} onChange={(e) => set("equity", e.target.value)} />
            </Field>
            <Field label="הכנסה נטו חודשית משותפת (₪)">
              <input className={inputCls} inputMode="numeric" value={f.income} onChange={(e) => set("income", e.target.value)} />
            </Field>
            <Field label="החזרים חודשיים קיימים - הלוואות, ליסינג (₪)">
              <input className={inputCls} inputMode="numeric" value={f.obligations} onChange={(e) => set("obligations", e.target.value)} />
            </Field>
            <Field label="גיל (של המבוגר מבין הלווים)">
              <input className={inputCls} inputMode="numeric" value={f.age} onChange={(e) => set("age", e.target.value)} />
            </Field>
            <hr className="border-[#C8DDD2]" />
            <p className="text-sm font-semibold">לאן לשלוח את התוצאה?</p>
            <Field label="שם">
              <input className={inputCls} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="טלפון">
              <input className={inputCls} type="tel" autoComplete="tel" inputMode="tel" dir="ltr" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} />
            <label className="flex items-start gap-2 text-xs text-[#1A1A2E]/80">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              אני מאשר שצ'יקו פייננס ייצור איתי קשר בטלפון או בוואטסאפ בנוגע לבדיקה.
            </label>
            {err && <p className="text-sm font-semibold text-[#C0392B]">{err}</p>}
            <button disabled={busy} className="rounded-xl bg-[#2E8B57] px-4 py-3 text-base font-bold text-white disabled:opacity-60">
              {busy ? "רגע..." : "הצג לי את התוצאה"}
            </button>
          </form>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#1A1A2E]/70">{f.name}, זו ההערכה שלך:</p>
            <div className="rounded-xl bg-[#2E8B57]/10 p-4 text-center">
              <div className="text-sm">משכנתה אפשרית, עד</div>
              <div className="text-3xl font-extrabold text-[#2E8B57]">{ils(r.maxMortgage)}</div>
              <div className="text-xs text-[#1A1A2E]/60">
                מוגבלת על ידי {r.limitedBy === "income" ? "יכולת ההחזר מההכנסה" : "אחוז המימון המותר בעסקה"}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[#1A1A2E]/60">משכנתה שהעסקה דורשת</dt><dd className="font-bold">{ils(r.needed)}</dd></div>
              <div><dt className="text-[#1A1A2E]/60">החזר חודשי משוער</dt><dd className="font-bold">{ils(r.payment)}</dd></div>
              <div><dt className="text-[#1A1A2E]/60">תקופה מקסימלית</dt><dd className="font-bold">{r.years} שנה</dd></div>
              <div><dt className="text-[#1A1A2E]/60">מההכנסה הפנויה</dt><dd className="font-bold">{r.ptiActual.toFixed(0)}%</dd></div>
            </dl>
            <p className={`rounded-lg p-3 text-sm font-semibold ${r.enough ? "bg-[#2E8B57]/10 text-[#1f6b43]" : "bg-[#B8860B]/15 text-[#7a5a08]"}`}>
              {r.enough
                ? "העסקה נראית ריאלית לפי הנתונים שהזנת."
                : `לפי הנתונים, חסרים בערך ${ils(r.equityMissing)} של מימון או הון עצמי כדי שהעסקה תסתדר. שווה לבדוק איך אפשר לסגור את הפער.`}
            </p>
            <a href={`https://wa.me/${WA}?text=${waText}`} className="rounded-xl bg-[#25D366] px-4 py-3 text-center text-base font-bold text-white">
              שלח לצ'יקו בוואטסאפ
            </a>
            <a href="tel:0507700322" className="text-center text-sm underline">או התקשר: 050-7700322</a>
            {!saved && <p className="text-xs text-[#1A1A2E]/60">אם לא תשמע ממני תוך יום, שלח לי בוואטסאפ ואחזור אליך.</p>}
            <p className="text-xs text-[#1A1A2E]/50">
              זו הערכה ראשונית בלבד ואינה ייעוץ או התחייבות לאישור אשראי. התוצאה בפועל תלויה בבנק, בדוח האשראי ובבדיקה מלאה.
            </p>
          </section>
        )}
        <p className="text-center text-xs text-[#1A1A2E]/50">TICO FINANCE · אדריכל המשכנתאות</p>
      </main>
    </div>
  );
}
