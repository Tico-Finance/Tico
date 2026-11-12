"use client";

import type { CaseType, CostItem, CostKind, PayPreset, PlanSettings } from "@/lib/business-plan/types";
import { PAY_LABELS, TYPE_PRESETS, applyPay, newCaseType } from "@/lib/business-plan/defaults";
import { payOf } from "@/lib/business-plan/model";
import { MONTHS, money } from "@/lib/business-plan/format";
import { Btn, Card, Chip, NumInput, Select, TextInput, cx } from "./ui";
import { Timeline } from "./timeline";

export type Upd = (fn: (d: PlanSettings) => void) => void;

const STEPS = ["היעד", "סוגי תיקים", "זמן וגבייה", "המרות", "לידים"];
const uid = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;

function Q({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-base font-bold text-foreground">{label}</div>
        {hint && <div className="text-xs text-foreground/55">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

const sumShares = (a: { on: boolean; share: number }[]) => a.filter((x) => x.on).reduce((s, x) => s + (+x.share || 0), 0);

function SumChip({ total }: { total: number }) {
  return total === 100 ? (
    <span className="pl-pill good">✓ סה״כ 100%</span>
  ) : (
    <span className="pl-pill warn">▲ סה״כ {total}% (מנורמל ל-100%)</span>
  );
}

export default function Wizard({
  S, upd, step, go, finish, planYear,
}: { S: PlanSettings; upd: Upd; step: number; go: (n: number) => void; finish: () => void; planYear: number }) {
  const last = STEPS.length;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {step > 0 && (
        <ol className="flex justify-between gap-1.5">
          {STEPS.map((t, i) => {
            const n = i + 1;
            const cur = n === step;
            const done = n < step;
            return (
              <li key={t} className="min-w-0 flex-1">
                <button type="button" onClick={() => go(n)} aria-current={cur ? "step" : undefined} className="flex w-full flex-col items-center gap-1.5 px-0.5 py-1">
                  <i
                    className={cx("grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold not-italic")}
                    style={{
                      background: cur ? "var(--pl-accent)" : done ? "color-mix(in srgb, var(--pl-accent) 15%, transparent)" : "var(--pl-soft)",
                      borderColor: cur || done ? "var(--pl-accent)" : "var(--pl-line)",
                      color: cur ? "var(--pl-accent-fg)" : "inherit",
                    }}
                  >{n}</i>
                  <span className={cx("hidden text-xs sm:block", cur ? "font-bold" : "text-foreground/60")}>{t}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {step > 0 && <p className="text-center text-sm font-bold sm:hidden">{STEPS[step - 1]}</p>}

      <Card className="flex flex-col gap-6 p-6">
        {step === 0 && <Welcome go={go} finish={finish} />}
        {step === 1 && <StepGoal S={S} upd={upd} planYear={planYear} />}
        {step === 2 && <StepTypes S={S} upd={upd} />}
        {step === 3 && <StepPay S={S} upd={upd} />}
        {step === 4 && <StepConv S={S} upd={upd} />}
        {step === 5 && <StepLeads S={S} upd={upd} />}
      </Card>

      {step > 0 && (
        <div className="flex justify-between gap-3">
          {step > 1 ? <Btn onClick={() => go(step - 1)}>חזרה</Btn> : <span />}
          {step < last ? <Btn variant="pri" onClick={() => go(step + 1)}>הבא</Btn> : <Btn variant="pri" onClick={finish}>בנה את התוכנית שלי</Btn>}
        </div>
      )}
    </div>
  );
}

function Welcome({ go, finish }: { go: (n: number) => void; finish: () => void }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-3xl font-extrabold text-primary">בוא נבנה את התוכנית שלך לשנה הקרובה</h1>
      <p className="max-w-prose text-foreground/70">
        חמש שאלות קצרות על היעד, סוגי התיקים והגבייה שלך. בסוף תקבל תוכנית עבודה: כמה תיקים, לידים, פגישות ותוכן צריך, ומה נשאר בכיס.
      </p>
      <p className="text-sm text-foreground/50">ההנחות שמולאו מראש הן דוגמה. אפשר לשנות כל אחת.</p>
      <div className="flex flex-wrap gap-3">
        <Btn variant="pri" onClick={() => go(1)}>מתחילים</Btn>
        <Btn onClick={finish}>דלג והראה לי דוגמה</Btn>
      </div>
    </div>
  );
}

/* ---------- step 1: goal + expenses ---------- */

function StepGoal({ S, upd, planYear }: { S: PlanSettings; upd: Upd; planYear: number }) {
  const addCost = (kind: "emp" | "asst" | "op" | "other") =>
    upd((d) => {
      const dt = new Date(planYear, d.start + 3, 1);
      const base = { fm: dt.getMonth(), fy: dt.getFullYear(), tm: -1, ty: dt.getFullYear() };
      const hasOp = d.costItems.some((i) => i.kind === "case");
      const prices = Object.fromEntries(d.types.map((t) => [t.id, t.opCost || 0]));
      d.costItems.push(
        kind === "emp" ? { ...base, n: "עובד/ת", kind: "month", amt: 15000, hrs: 35 }
        : kind === "asst" ? { ...base, n: "עוזרת אישית", kind: "hours", hpm: 40, rate: 80, vat: false }
        : kind === "op" ? { ...base, n: hasOp ? "מתפעל נוסף" : "מתפעל", kind: "case", share: hasOp ? 50 : 100, rem: 3, prices }
        : { ...base, n: "הוצאה חדשה", kind: "month", amt: 5000, hrs: 0 }
      );
    });

  return (
    <>
      <h2 className="text-2xl font-extrabold text-primary">מה היעד שלך?</h2>
      <Q label="כמה אתה רוצה שייכנס לך השנה?" hint="הכנסה בפועל לחשבון, לפני הוצאות">
        <div className="pl-bigin">
          <span>₪</span>
          <input type="number" inputMode="numeric" step={10000} value={S.target} aria-label="יעד שנתי"
            onChange={(e) => upd((d) => { d.target = Math.max(+e.target.value || 0, 0); })} />
        </div>
        <input type="range" min={150000} max={1500000} step={10000} value={Math.min(Math.max(S.target, 150000), 1500000)} aria-label="יעד שנתי"
          onChange={(e) => upd((d) => { d.target = +e.target.value; })} />
      </Q>
      <Q label="כמה אתה מוציא בכל חודש?" hint="משרד, מחיה והוצאות קבועות אחרות">
        <NumInput value={S.fixed} step={1000} unit="₪" label="הוצאות חודשיות" onChange={(n) => upd((d) => { d.fixed = n; })} className="self-start" />
      </Q>

      <div className="flex flex-col gap-3">
        <div>
          <div className="text-base font-bold">הוצאות שמתווספות בהמשך</div>
          <div className="text-xs text-foreground/55">
            למשל עובד בשכר חודשי, עוזרת בחבילת שעות, מתפעלים שמקבלים סכום על כל תיק (אפשר כמה, כל אחד עם מחירון משלו), שכירות משרד או קורס.
            מגדירים מתי זה מתחיל ומתי נגמר. עובד מוסיף שעות עבודה, ומתפעל משאיר לך רק את שעות הסגירה והתמהיל.
          </div>
        </div>
        {S.costItems.length === 0 && <p className="text-sm text-foreground/50">עוד לא הוספת הוצאות עתידיות.</p>}
        {S.costItems.map((it, i) => (
          <CostItemCard key={i} S={S} it={it} i={i} upd={upd} planYear={planYear} />
        ))}
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => addCost("op")}>+ מתפעל (לפי תיק)</Chip>
          <Chip onClick={() => addCost("emp")}>+ עובד/ת (שכר חודשי)</Chip>
          <Chip onClick={() => addCost("asst")}>+ עוזרת (חבילת שעות)</Chip>
          <Chip onClick={() => addCost("other")}>+ הוצאה חדשה</Chip>
        </div>
      </div>

      <Q label="איזו תקופה התוכנית מכסה?" hint={`בתוך ${planYear}. אפשר להתחיל באמצע השנה ולסיים בדצמבר, או לתכנן שנה שלמה`}>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={S.start} label="מחודש" className="self-start" options={MONTHS.map((m, v) => ({ v, label: m }))}
            onChange={(v) => upd((d) => { d.start = v; if ((d.end ?? 11) < v) d.end = v; })} />
          <span className="text-foreground/60">עד</span>
          <Select value={S.end ?? 11} label="עד חודש" className="self-start" options={MONTHS.map((m, v) => ({ v, label: m })).filter((o) => o.v >= S.start)}
            onChange={(v) => upd((d) => { d.end = v; })} />
        </div>
      </Q>
      <Q label="כמה תיקים כבר פתוחים אצלך עכשיו?" hint="תיקים שעוד לא נחתמו">
        <NumInput value={S.open} unit="תיקים" label="תיקים פתוחים" className="self-start" onChange={(n) => upd((d) => { d.open = n; })} />
      </Q>
    </>
  );
}

const KINDS: { v: CostKind; label: string }[] = [
  { v: "month", label: "שכר חודשי" },
  { v: "hours", label: "חבילת שעות" },
  { v: "case", label: "לפי תיק" },
  { v: "once", label: "חד־פעמית" },
];

function CostItemCard({ S, it, i, upd, planYear }: { S: PlanSettings; it: CostItem; i: number; upd: Upd; planYear: number }) {
  const set = (fn: (x: CostItem) => void) => upd((d) => fn(d.costItems[i]));
  const years = Array.from({ length: 6 }, (_, k) => planYear - 1 + k);
  const monthOpts = MONTHS.map((m, v) => ({ v, label: m }));
  const endOpts = [{ v: -1, label: "ללא סיום" }, ...monthOpts];
  const yearOpts = years.map((y) => ({ v: y, label: String(y) }));
  const dates = (
    <>
      <Mini label={it.kind === "once" ? "בחודש" : "מתחיל ב"}>
        <span className="flex gap-1.5">
          <Select value={it.fm} options={monthOpts} label="חודש התחלה" onChange={(v) => set((x) => { x.fm = v; })} />
          <Select value={it.fy} options={yearOpts} label="שנת התחלה" onChange={(v) => set((x) => { x.fy = v; })} />
        </span>
      </Mini>
      {it.kind !== "once" && (
        <Mini label="נגמר ב">
          <span className="flex gap-1.5">
            <Select value={it.tm} options={endOpts} label="חודש סיום" onChange={(v) => set((x) => { x.tm = v; })} />
            <Select value={it.ty} options={yearOpts} label="שנת סיום" onChange={(v) => set((x) => { x.ty = v; })} />
          </span>
        </Mini>
      )}
    </>
  );
  const monthlyHours = (it.hpm ?? 0) * (it.rate ?? 0) * (it.vat ? 1.18 : 1);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-3">
      <div className="flex items-center gap-3">
        <TextInput value={it.n} label="שם" className="flex-1" onChange={(s) => set((x) => { x.n = s; })} />
        <button type="button" className="pl-link text-sm" onClick={() => upd((d) => { d.costItems.splice(i, 1); })}>הסר</button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="סוג ההוצאה">
        {KINDS.map((k) => (
          <Chip key={k.v} pressed={it.kind === k.v} onClick={() => set((x) => {
            x.kind = k.v;
            if (k.v === "case" && !x.prices) x.prices = Object.fromEntries(S.types.map((t) => [t.id, t.opCost || 0]));
            if (k.v === "hours" && x.hpm == null) { x.hpm = 40; x.rate = 80; }
          })}>{k.label}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {it.kind === "month" && (
          <>
            <Mini label="סכום בחודש"><NumInput value={it.amt ?? 0} step={500} unit="₪" onChange={(n) => set((x) => { x.amt = n; })} width={140} /></Mini>
            {dates}
            <Mini label="שעות עבודה שמתווספות בשבוע"><NumInput value={it.hrs ?? 0} step={5} unit="שעות" onChange={(n) => set((x) => { x.hrs = n; })} width={140} /></Mini>
          </>
        )}
        {it.kind === "hours" && (
          <>
            <Mini label="שעות בחבילה, בחודש"><NumInput value={it.hpm ?? 0} step={5} unit="שעות" onChange={(n) => set((x) => { x.hpm = n; })} width={140} /></Mini>
            <Mini label="מחיר לשעה"><NumInput value={it.rate ?? 0} step={5} unit="₪" onChange={(n) => set((x) => { x.rate = n; })} width={140} /></Mini>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={!!it.vat} onChange={(e) => set((x) => { x.vat = e.target.checked; })} className="h-4 w-4 accent-primary" />
              בתוספת מע״מ (18%)
            </label>
            {dates}
            <Mini label="עלות חודשית"><span className="text-base font-bold">≈ {money(monthlyHours)} בחודש</span></Mini>
          </>
        )}
        {it.kind === "case" && (
          <>
            <Mini label="אחוז מהתיקים שעוברים אליו"><NumInput value={it.share ?? 100} step={10} unit="%" onChange={(n) => set((x) => { x.share = n; })} width={140} /></Mini>
            {dates}
            <Mini label="שעות שאני עדיין מעורב בכל תיק"><NumInput value={it.rem ?? 3} step={0.5} unit="שעות" onChange={(n) => set((x) => { x.rem = n; })} width={140} /></Mini>
          </>
        )}
        {it.kind === "once" && (
          <>
            <Mini label="סכום חד־פעמי"><NumInput value={it.amt ?? 0} step={500} unit="₪" onChange={(n) => set((x) => { x.amt = n; })} width={140} /></Mini>
            {dates}
          </>
        )}
      </div>
      {it.kind === "case" && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold">המחירון של {it.n}, לכל תיק לפי סוג</div>
          <div className="flex flex-wrap gap-3">
            {S.types.map((t) => (
              <Mini key={t.id} label={t.n}>
                <NumInput value={it.prices?.[t.id] ?? t.opCost ?? 0} step={100} unit="₪" width={140}
                  onChange={(n) => set((x) => { x.prices = { ...(x.prices ?? {}), [t.id]: n }; })} />
              </Mini>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold">{label}</span>
      {children}
    </div>
  );
}

/* ---------- step 2: case types ---------- */

function StepTypes({ S, upd }: { S: PlanSettings; upd: Upd }) {
  const addType = (k: number) =>
    upd((d) => {
      const p = k >= 0 ? TYPE_PRESETS[k] : { n: "סוג תיק חדש", fee: 9000, opCost: 3000, lag: 3 };
      d.types.push(newCaseType(p, d.g, uid()));
    });
  return (
    <>
      <h2 className="text-2xl font-extrabold text-primary">אילו סוגי תיקים אתה עושה?</h2>
      <p className="text-sm text-foreground/60">סמן את הסוגים שלך, כתוב כמה אתה גובה, ובאיזה אחוז מהתיקים שלך הם מופיעים.</p>
      <div className="flex flex-col gap-3">
        {S.types.map((t, i) => (
          <div key={t.id} className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-black/10 p-3", !t.on && "opacity-55")}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={t.on} className="h-5 w-5 accent-primary" aria-label="פעיל"
                onChange={(e) => upd((d) => {
                  if (!e.target.checked && d.types.filter((x) => x.on).length <= 1) return;
                  d.types[i].on = e.target.checked;
                })} />
              <span className="h-3 w-3 rounded-sm" style={{ background: `var(--pl-t${(i % 10) + 1})` }} />
            </label>
            <TextInput value={t.n} label="שם סוג תיק" className="min-w-40 flex-1" onChange={(s) => upd((d) => { d.types[i].n = s; })} />
            <label className="flex flex-col gap-1 text-xs"><span>עמלה</span>
              <NumInput value={t.fee} step={500} unit="₪" width={130} onChange={(n) => upd((d) => { d.types[i].fee = n; })} /></label>
            <label className="flex flex-col gap-1 text-xs"><span>מהתיקים</span>
              <NumInput value={t.share} step={5} unit="%" width={110} onChange={(n) => upd((d) => { d.types[i].share = n; })} /></label>
            {S.types.length > 1 && (
              <button type="button" className="pl-link text-sm" onClick={() => upd((d) => { d.types.splice(i, 1); })}>הסר סוג</button>
            )}
          </div>
        ))}
      </div>
      <SumChip total={sumShares(S.types)} />
      <div>
        <div className="text-base font-bold">סוגי תיקים נוספים</div>
        <div className="text-xs text-foreground/55">מתוך מחירון המתפעל. העמלה שלך לכל סוג היא הנחה, ואפשר לשנות אותה.</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TYPE_PRESETS.map((p, k) => (S.types.some((t) => t.n === p.n) ? null : <Chip key={p.n} onClick={() => addType(k)}>+ {p.n}</Chip>))}
        <Chip onClick={() => addType(-1)}>+ סוג אחר</Chip>
      </div>
    </>
  );
}

/* ---------- step 3: lag + collection ---------- */

function StepPay({ S, upd }: { S: PlanSettings; upd: Upd }) {
  return (
    <>
      <h2 className="text-2xl font-extrabold text-primary">כמה זמן לוקח וכמה אתה גובה?</h2>
      <p className="text-sm text-foreground/60">
        לכל סוג תיק: כמה חודשים עוברים מרגע שהליד מגיע ועד החתימה, ואיך אתה גובה את העמלה. הציר מראה מתי נכנס הכסף.
      </p>
      <div className="flex flex-col gap-3">
        {S.types.map((t, i) => (t.on ? <PayCard key={t.id} t={t} i={i} upd={upd} /> : null))}
      </div>
    </>
  );
}

function PayCard({ t, i, upd }: { t: CaseType; i: number; upd: Upd }) {
  const set = (fn: (x: CaseType) => void) => upd((d) => fn(d.types[i]));
  const monthOpts = Array.from({ length: 10 }, (_, v) => ({ v, label: `חודש ${v}` }));
  const lagOpts = [1, 2, 3, 4, 5, 6].map((v) => ({ v, label: v === 1 ? "חודש" : `${v} חודשים` }));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-3">
      <div className="flex items-center gap-2 text-base font-bold">
        <span className="h-3 w-3 rounded-sm" style={{ background: `var(--pl-t${(i % 10) + 1})` }} />{t.n}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">מליד עד חתימה</span>
        <Select value={t.lag} options={lagOpts} label="חודשים עד חתימה"
          onChange={(v) => set((x) => { x.lag = v; if (x.pay !== "custom") applyPay(x); })} />
      </div>
      <div className="font-bold">איך אתה גובה?</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="סוג גבייה">
        {(["upfront", "split", "three", "custom"] as PayPreset[]).map((p) => (
          <Chip key={p} pressed={t.pay === p} onClick={() => set((x) => { x.pay = p; if (p !== "custom") applyPay(x); })}>{PAY_LABELS[p]}</Chip>
        ))}
      </div>
      {t.pay === "custom" && (
        <div className="flex flex-wrap gap-3">
          {([["pa", "oa", "מקדמה"], ["pp", "op", "התקדמות"], ["pe", "oe", "ביצוע"]] as const).map(([p, o, label]) => (
            <Mini key={p} label={label}>
              <NumInput value={t[p]} step={5} unit="%" width={110} onChange={(n) => set((x) => { x[p] = n; })} />
              <Select value={t[o]} options={monthOpts} label="חודש גבייה" onChange={(v) => set((x) => { x[o] = v; })} />
            </Mini>
          ))}
        </div>
      )}
      <Timeline lag={t.lag} pay={payOf(t)} />
    </div>
  );
}

/* ---------- step 4: conversions ---------- */

function StepConv({ S, upd }: { S: PlanSettings; upd: Upd }) {
  const g = S.g;
  const a = g.c1, b = (a * g.c2) / 100, c = (b * g.c3) / 100;
  const rows = [
    ["c1", "ליד שהופך לפגישה"],
    ["c2", "פגישה שהופכת להגשה לבנקים"],
    ["c3", "הגשה שהופכת לחתימה"],
  ] as const;
  return (
    <>
      <h2 className="text-2xl font-extrabold text-primary">מה אחוזי ההמרה שלך?</h2>
      <p className="text-sm text-foreground/60">איזה חלק מהלידים מתקדם בכל שלב. הכוונון כאן חל על כל סוגי התיקים, ואפשר לדייק לכל סוג למטה.</p>
      {rows.map(([k, label]) => (
        <Q key={k} label={label}>
          <div className="flex items-center gap-4">
            <input type="range" min={5} max={100} step={1} value={g[k]} aria-label={label} className="flex-1"
              onChange={(e) => upd((d) => { const v = +e.target.value; d.g[k] = v; d.types.forEach((t) => { t[k] = v; }); })} />
            <b className="num min-w-[3.4ch] text-end text-2xl">{g[k]}%</b>
          </div>
        </Q>
      ))}
      <div className="rounded-xl bg-black/[.04] p-4 text-base">
        מתוך 100 לידים: <b><span className="num">{Math.round(a * 10) / 10}</span></b> פגישות,{" "}
        <b><span className="num">{Math.round(b * 10) / 10}</span></b> הגשות לבנקים,{" "}
        <b><span className="num">{Math.round(c * 10) / 10}</span></b> חתימות
      </div>
      <details>
        <summary className="cursor-pointer font-semibold text-primary">לדייק לכל סוג תיק בנפרד</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="pl-table">
            <thead><tr><th>סוג</th><th>ליד←פגישה</th><th>פגישה←הגשה</th><th>הגשה←חתימה</th></tr></thead>
            <tbody>
              {S.types.map((t, i) =>
                t.on ? (
                  <tr key={t.id}>
                    <th scope="row">{t.n}</th>
                    {(["c1", "c2", "c3"] as const).map((k) => (
                      <td key={k}><NumInput value={t[k]} unit="%" min={1} max={100} width={96} onChange={(n) => upd((d) => { d.types[i][k] = n; })} /></td>
                    ))}
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/* ---------- step 5: lead channels ---------- */

function StepLeads({ S, upd }: { S: PlanSettings; upd: Upd }) {
  return (
    <>
      <h2 className="text-2xl font-extrabold text-primary">מאיפה יגיעו הלידים?</h2>
      <p className="text-sm text-foreground/60">
        סמן את הערוצים שלך. &quot;חלק מהלידים&quot; הוא כמה מהלידים החדשים אמורים להגיע מהערוץ, ו&quot;לידים ליחידה&quot; הוא כמה לידים מביא בממוצע כל פוסט, סרטון או הרצאה.
      </p>
      <div className="flex flex-col gap-3">
        {S.chans.map((c, i) => (
          <div key={i} className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-black/10 p-3", !c.on && "opacity-55")}>
            <input type="checkbox" checked={c.on} className="h-5 w-5 accent-primary" aria-label="פעיל"
              onChange={(e) => upd((d) => {
                if (!e.target.checked && d.chans.filter((x) => x.on).length <= 1) return;
                d.chans[i].on = e.target.checked;
              })} />
            {c.custom ? (
              <TextInput value={c.n} label="שם ערוץ" className="min-w-40 flex-1" onChange={(s) => upd((d) => { d.chans[i].n = s; })} />
            ) : (
              <b className="min-w-40 flex-1">{c.n}</b>
            )}
            <label className="flex flex-col gap-1 text-xs"><span>חלק מהלידים</span>
              <NumInput value={c.share} step={5} unit="%" width={110} onChange={(n) => upd((d) => { d.chans[i].share = n; })} /></label>
            <label className="flex flex-col gap-1 text-xs"><span>לידים ל{c.unit}</span>
              <NumInput value={c.y} step={0.1} min={0.05} width={110} onChange={(n) => upd((d) => { d.chans[i].y = n; })} /></label>
            {c.custom && (
              <button type="button" className="pl-link text-sm" onClick={() => upd((d) => { if (d.chans.length > 1) d.chans.splice(i, 1); })}>הסר</button>
            )}
          </div>
        ))}
      </div>
      <SumChip total={sumShares(S.chans)} />
      <div>
        <Chip onClick={() => upd((d) => { d.chans.push({ n: "ערוץ חדש", unit: "פעולה", on: true, share: 5, y: 1, cost: 0, h: 1, custom: true }); })}>+ ערוץ חדש</Chip>
      </div>
      <Q label="כמה לידים מגיעים מהפניות של לקוחות קיימים?" hint="לכל תיק שנחתם">
        <NumInput value={S.ref} step={0.05} unit="לידים" label="לידים מהפניות" className="self-start" onChange={(n) => upd((d) => { d.ref = n; })} />
      </Q>
      <Q label="כמה שעות בשבוע אתה יכול לעבוד?" hint="כדי לבדוק אם התוכנית ריאלית">
        <NumInput value={S.hours} unit="שעות" label="שעות זמינות" className="self-start" onChange={(n) => upd((d) => { d.hours = n; })} />
      </Q>
      <details>
        <summary className="cursor-pointer font-semibold text-primary">עוד פרטים (שעות ועלויות)</summary>
        <div className="mt-3 flex flex-col gap-4">
          <Q label="משך פגישה, כולל הכנה"><NumInput value={S.meetH} step={0.25} unit="שעות" className="self-start" onChange={(n) => upd((d) => { d.meetH = n; })} /></Q>
          <Q label="שעות קבועות אחרות בשבוע" hint="אדמיניסטרציה, שיווק כללי"><NumInput value={S.otherH} unit="שעות" className="self-start" onChange={(n) => upd((d) => { d.otherH = n; })} /></Q>
          <div className="overflow-x-auto">
            <table className="pl-table">
              <thead><tr><th>ערוץ</th><th>עלות ליחידה (₪)</th><th>שעות ליחידה</th></tr></thead>
              <tbody>
                {S.chans.map((c, i) => (
                  <tr key={i}>
                    <th scope="row">{c.n}</th>
                    <td><NumInput value={c.cost} step={10} width={110} onChange={(n) => upd((d) => { d.chans[i].cost = n; })} /></td>
                    <td><NumInput value={c.h} step={0.25} width={110} onChange={(n) => upd((d) => { d.chans[i].h = n; })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}
