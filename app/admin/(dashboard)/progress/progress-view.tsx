import Link from "next/link";
import { deltaPct, type WeekStats } from "@/lib/progress";

// Weekly progress: stacked bars of points by how close they are to money, the share of
// money-focused work per week, and this week against the previous one.

const COLORS = { direct: "#1f6b43", pipeline: "#3b9ab2", exposure: "#f5ac32", maintenance: "#94a3b8" } as const;
const LABELS = { direct: "קרוב להכנסה", pipeline: "בניית צנרת", exposure: "חשיפה", maintenance: "תחזוקה" } as const;
type Cat = keyof typeof COLORS;
const CATS: Cat[] = ["direct", "pipeline", "exposure", "maintenance"];

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const METRICS: { key: keyof WeekStats; label: string }[] = [
  { key: "messages", label: "הודעות לשותפים" },
  { key: "replies", label: "תשובות משותפים" },
  { key: "meetings", label: "פגישות עם שותפים" },
  { key: "stages", label: "שלבים אצל לקוחות" },
  { key: "clientsDone", label: "תיקים שנסגרו" },
  { key: "leads", label: "לידים חדשים" },
  { key: "content", label: "תוכן שפורסם" },
  { key: "tasksDone", label: "משימות שבוצעו" },
];

export default function ProgressView({ weeks }: { weeks: WeekStats[] }) {
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const delta = prev ? deltaPct(cur.total, prev.total) : null;
  const best = Math.max(...weeks.map((w) => w.total));

  // Stacked bars
  const W = 640, H = 220, pad = { l: 8, r: 8, t: 22, b: 26 };
  const innerH = H - pad.t - pad.b;
  const slot = (W - pad.l - pad.r) / weeks.length;
  const bar = slot * 0.62;
  const max = Math.max(1, best);
  const bars = weeks.map((w, i) => {
    let y = H - pad.b;
    const x = pad.l + slot * i + (slot - bar) / 2;
    const parts = CATS.map((c) => {
      const h = (w[c] / max) * innerH;
      y -= h;
      return { c, y, h };
    });
    return { w, x, parts, top: y, isNow: i === weeks.length - 1 };
  });

  // Money focus line
  const known = weeks.filter((w) => w.moneyShare !== null);
  const LH = 90;
  const px = (i: number) => pad.l + slot * i + slot / 2;
  const py = (v: number) => 8 + (1 - v / 100) * (LH - 24);
  const pts = weeks.map((w, i) => (w.moneyShare === null ? null : [px(i), py(w.moneyShare)] as const));
  const path = pts.filter((p): p is readonly [number, number] => p !== null).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">השבוע שלי</h1>
          <p className="text-sm text-foreground/60">נקודות קידום לפי כמה קרוב כל דבר להכנסה. שבוע הוא ראשון עד שבת.</p>
        </div>
        <Link href="/admin/home" className="text-sm text-secondary">חזרה ליום</Link>
      </div>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-4xl font-bold text-primary">{cur.total}</div>
            <div className="text-xs text-foreground/60">נקודות השבוע</div>
            {delta !== null && <div className={`text-sm font-bold ${delta >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% מהשבוע שעבר</div>}
            {delta === null && prev && prev.total === 0 && cur.total > 0 && <div className="text-sm font-bold text-emerald-700">▲ שבוע ראשון עם נתונים</div>}
          </div>
          <div>
            <div className="text-4xl font-bold text-primary">{cur.moneyShare === null ? "—" : `${cur.moneyShare}%`}</div>
            <div className="text-xs text-foreground/60">מיקוד בהכנסה</div>
            <div className="text-xs text-foreground/50">{prev?.moneyShare == null ? "" : `שבוע שעבר: ${prev.moneyShare}%`}</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary">{best}</div>
            <div className="text-xs text-foreground/60">השבוע הכי טוב</div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="נקודות קידום לפי שבוע">
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#d4d4d8" />
          {bars.map(({ w, x, parts, top, isNow }) => (
            <g key={w.start}>
              {parts.map((p) => p.h > 0 && <rect key={p.c} x={x} y={p.y} width={bar} height={p.h} fill={COLORS[p.c]} opacity={isNow ? 1 : 0.8} />)}
              {w.total > 0 && <text x={x + bar / 2} y={top - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#26332b">{w.total}</text>}
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={isNow ? "#1f6b43" : "#71717a"} fontWeight={isNow ? 700 : 400}>{isNow ? "השבוע" : fmt(w.start)}</text>
            </g>
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
          {CATS.map((c) => <span key={c} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[c] }} />{LABELS[c]}</span>)}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-1 font-semibold text-primary">כמה מהעבודה קרובה להכנסה</h2>
        <p className="mb-2 text-xs text-foreground/60">האחוז מהנקודות שהגיעו מקידום לקוחות, סגירת תיקים, לידים ומשימות הכנסה. המטרה היא לראות אותו עולה.</p>
        {known.length < 2 ? (
          <p className="py-4 text-sm text-foreground/50">אחרי שבועיים של פעילות יופיע כאן הקו.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${LH}`} className="w-full" role="img" aria-label="מיקוד בהכנסה לפי שבוע">
            {[0, 50, 100].map((v) => <line key={v} x1={pad.l} x2={W - pad.r} y1={py(v)} y2={py(v)} stroke="#e4e4e7" strokeDasharray="3 3" />)}
            <path d={path} fill="none" stroke="#1f6b43" strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((p, i) => p && (
              <g key={weeks[i].start}>
                <circle cx={p[0]} cy={p[1]} r="4" fill="#1f6b43" />
                <text x={p[0]} y={p[1] - 8} textAnchor="middle" fontSize="11" fill="#26332b">{weeks[i].moneyShare}%</text>
              </g>
            ))}
          </svg>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-semibold text-primary">השבוע מול השבוע שעבר</h2>
        <ul className="divide-y divide-black/5">
          {METRICS.map((m) => {
            const a = cur[m.key] as number;
            const b = prev ? (prev[m.key] as number) : 0;
            const d = deltaPct(a, b);
            return (
              <li key={m.key} className="flex items-center justify-between py-2 text-sm">
                <span>{m.label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-foreground/50">{b}</span>
                  <span className="font-bold">{a}</span>
                  <span className={`w-14 text-left text-xs font-bold ${d === null ? "text-foreground/40" : d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-600" : "text-foreground/40"}`}>
                    {d === null ? (a > 0 ? "חדש" : "") : d === 0 ? "—" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}%`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-foreground/50">נקודות: שלב אצל לקוח 3, תיק שנסגר 10, ליד חדש 2, תשובה משותף 3, פגישה עם שותף 5, הודעה 1, תוכן שפורסם 3, משימה 1–2.</p>
      </section>
    </div>
  );
}
