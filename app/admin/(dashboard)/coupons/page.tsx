import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import { redeemCouponAction } from "./actions";

export const metadata = { title: "קופונים | Tico" };

const isExpired = (d: Date) => d.getTime() < Date.now();

const fmt = (d: Date) =>
  d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");
  const { q } = await searchParams;

  const all = await db.select().from(coupons).orderBy(desc(coupons.number)).limit(500);
  const query = (q ?? "").trim().toUpperCase().replace(/^TICO-?/, "");
  const rows = query
    ? all.filter(
        (c) =>
          String(c.number).padStart(4, "0") === query.padStart(4, "0") ||
          c.code === query ||
          c.email.toUpperCase().includes(query) ||
          c.name.toUpperCase().includes(query)
      )
    : all;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-primary">קופונים</h1>
      <p className="text-sm text-foreground/70">
        כל קופון שנשלח ללקוח נרשם כאן עם מספר רץ וקוד אימות. כדי לוודא קופון אמיתי, חפשו לפי המספר או הקוד
        שהלקוח מציג. קופון שלא מופיע ברשימה הוא לא אמיתי.
      </p>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="מספר קופון, קוד אימות, שם או אימייל"
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button className="rounded-lg bg-button px-4 py-2 text-sm text-white">חיפוש</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-right text-foreground/70">
              <th className="p-2">מס׳</th>
              <th className="p-2">קוד</th>
              <th className="p-2">לקוח</th>
              <th className="p-2">הונפק</th>
              <th className="p-2">בתוקף עד</th>
              <th className="p-2">סטטוס</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const expired = isExpired(c.expiresAt);
              return (
                <tr key={c.id} className="border-b border-black/5">
                  <td className="p-2 font-semibold">{String(c.number).padStart(4, "0")}</td>
                  <td className="p-2 font-mono" dir="ltr">{c.code}</td>
                  <td className="p-2">
                    {c.name}
                    <div className="text-xs text-foreground/50" dir="ltr">{c.email}</div>
                  </td>
                  <td className="p-2">{fmt(c.createdAt)}</td>
                  <td className="p-2">{fmt(c.expiresAt)}</td>
                  <td className="p-2">
                    {c.redeemedAt ? (
                      <span className="text-foreground/60">מומש {fmt(c.redeemedAt)}</span>
                    ) : expired ? (
                      <span className="text-rose-600">פג תוקף</span>
                    ) : (
                      <span className="text-primary">בתוקף · {c.discountPercent}%</span>
                    )}
                  </td>
                  <td className="p-2">
                    {!c.redeemedAt && !expired && (
                      <form action={redeemCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/5">
                          סמן כמומש
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-foreground/60">
                  לא נמצא קופון כזה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
