import type { Pay } from "@/lib/business-plan/model";

const MAX = 9;
const pos = (o: number) => `${((Math.min(Math.max(o, 0), MAX) / MAX) * 100).toFixed(1)}%`;

/** Months from lead (right edge) to the cash collections, with the signing marked. */
export function Timeline({ lag, pay }: { lag: number; pay: Pay[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="relative mx-9 my-1 h-[84px] min-w-[240px]" role="img" aria-label="ציר זמן מליד עד גבייה">
        <div className="absolute inset-x-0 top-[34px] h-0.5" style={{ background: "var(--pl-line)" }} />
        {Array.from({ length: MAX + 1 }, (_, i) => (
          <span key={i} className="absolute top-[30px] h-2.5 w-px" style={{ insetInlineStart: pos(i), background: "var(--pl-line)" }} />
        ))}
        <Marker at={0}>
          <i className="absolute top-[28px] -ms-1.5 block h-3 w-3 rounded-full" style={{ background: "var(--pl-mute)" }} />
          <span className="absolute top-[46px] -ms-3 text-[11px] opacity-70">ליד</span>
        </Marker>
        <Marker at={lag}>
          <i className="absolute top-[42px] -ms-1.5 block h-3 w-3 rotate-45" style={{ background: "currentColor" }} />
          <span className="absolute top-[58px] -ms-8 whitespace-nowrap text-[11px] opacity-70">לקוח, חודש {lag}</span>
        </Marker>
        {pay.map((q) => {
          const size = 8 + q.pct * 10;
          return (
            <Marker key={q.n} at={q.off}>
              <span className="absolute top-0 -ms-8 w-16 text-center text-xs font-bold leading-tight">
                {Math.round(q.pct * 100)}%
                <small className="block text-[11px] font-normal opacity-60">{q.n}</small>
              </span>
              <i className="absolute block rounded-full" style={{ width: size, height: size, top: 35 - size / 2, marginInlineStart: -size / 2, background: "var(--pl-money)" }} />
            </Marker>
          );
        })}
      </div>
    </div>
  );
}

function Marker({ at, children }: { at: number; children: React.ReactNode }) {
  return <span className="absolute top-0 h-0 w-0" style={{ insetInlineStart: pos(at) }}>{children}</span>;
}
