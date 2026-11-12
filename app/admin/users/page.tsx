import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, rtmRuns, rtmBriefs } from "@/drizzle/schema";
import { ownerEmail } from "./owner";
import UserRow, { type UserView } from "./user-row";

export const dynamic = "force-dynamic";

function keyHint(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••";
  return "••••" + key.slice(-4);
}

export default async function UsersPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  // Only the owner may see the control panel; everyone else goes to their board.
  if (!email) redirect("/admin/login");
  if (email !== ownerEmail()) redirect("/admin/home");

  const rows = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));

  const scanCounts = await db
    .select({ userId: rtmRuns.userId, c: count() })
    .from(rtmRuns)
    .groupBy(rtmRuns.userId);
  const briefCounts = await db
    .select({ userId: rtmBriefs.userId, c: count() })
    .from(rtmBriefs)
    .where(eq(rtmBriefs.status, "approved"))
    .groupBy(rtmBriefs.userId);

  const scanMap = new Map(scanCounts.map((r) => [r.userId, r.c]));
  const briefMap = new Map(briefCounts.map((r) => [r.userId, r.c]));

  const view: UserView[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    hasKey: !!u.geminiApiKey,
    keyHint: keyHint(u.geminiApiKey),
    briefs: briefMap.get(u.id) ?? 0,
    scans: scanMap.get(u.id) ?? 0,
    isOwner: u.email.toLowerCase() === ownerEmail(),
  }));

  return (
    <div className="min-h-full" style={{ backgroundColor: "#EDF6F0" }}>
      <header
        className="flex items-center justify-between gap-3 px-5 py-4 text-white"
        style={{ backgroundColor: "#2E8B57" }}
      >
        <div>
          <h1 className="text-lg font-extrabold text-white">מערכת בקרה · יועצים</h1>
          <p className="text-xs text-white/85">מי נרשם, מפתחות Gemini וניהול סיסמאות</p>
        </div>
        <Link
          href="/admin/home"
          className="text-xs font-medium text-white underline-offset-2 hover:underline"
        >
          חזרה לחדשות ←
        </Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div
          className="rounded-2xl border p-4 text-xs shadow-sm"
          style={{ borderColor: "#D5E5DC", backgroundColor: "#ffffff", color: "#5B6B62" }}
        >
          נרשמו <b style={{ color: "#1F2A37" }}>{view.length}</b> יועצים. הסיסמאות
          שמורות מוצפנות ולא ניתנות לצפייה — אם יועץ שכח סיסמה, לחצו &quot;נהל&quot;
          והגדירו לו סיסמה חדשה.
        </div>

        {view.length === 0 && (
          <p
            className="rounded-2xl bg-white p-6 text-center text-sm shadow-sm"
            style={{ color: "#5B6B62" }}
          >
            עדיין אף אחד לא נרשם.
          </p>
        )}

        {view.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </main>
    </div>
  );
}
