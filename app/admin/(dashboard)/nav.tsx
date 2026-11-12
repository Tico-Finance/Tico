"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/admin/home", label: "היום", icon: "🏠" },
  { href: "/admin/partners", label: "שותפים", icon: "🤝" },
  { href: "/admin/clients", label: "לקוחות", icon: "📁" },
];

// Day-to-day screens that are not in the bar, then the older tools (kept until they are retired).
const MORE = [
  { href: "/admin/leads", label: "לידים" },
  { href: "/admin/progress", label: "השבוע שלי" },
  { href: "/admin/content", label: "מעקב תוכן" },
  { href: "/admin/plan", label: "תוכנית שנתית" },
  { href: "/admin/notifications", label: "התראות" },
];
const OLD = [
  { href: "/admin/canva", label: "תוכן" },
  { href: "/admin/drafts", label: "טיוטות לאישור" },
  { href: "/admin/import", label: "ייבוא פוסטים ידני" },
  { href: "/admin/rtm", label: "RTM – בריפים יומיים" },
  { href: "/admin/tikia", label: "תיקיה" },
  { href: "/admin/subscribers", label: "רשימת תפוצה" },
  { href: "/admin/topics", label: "נושאים" },
  { href: "/admin/templates", label: "תבניות תמונה" },
  { href: "/admin/history", label: "היסטוריה" },
];

export default function Nav({ email, logout }: { email?: string | null; logout: () => Promise<void> }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");

  const more = (
    // Re-keyed on navigation so the menu closes itself after a tap.
    <details key={path} className="group relative">
      <summary className="flex cursor-pointer list-none flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium text-primary md:flex-row md:gap-1.5 md:text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-lg md:hidden">☰</span>
        עוד
      </summary>
      <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-black/10 md:bottom-auto md:top-full md:mt-2">
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-primary/5">
            {m.label}
          </Link>
        ))}
        <details className="mt-1 border-t border-black/5">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs text-foreground/60 [&::-webkit-details-marker]:hidden">כלים ישנים ▾</summary>
          {OLD.map((m) => (
            <Link key={m.href} href={m.href} className="block rounded-lg px-3 py-1.5 text-sm text-foreground/70 hover:bg-primary/5">
              {m.label}
            </Link>
          ))}
        </details>
        <div className="mt-1 border-t border-black/5 px-3 pt-2 text-xs text-foreground/60">
          {email && <div className="mb-1 truncate">{email}</div>}
          <form action={logout}>
            <button type="submit" className="text-sm text-rose-600">התנתקות</button>
          </form>
        </div>
      </div>
    </details>
  );

  const item = (m: (typeof MAIN)[number], desktop: boolean) => (
    <Link
      key={m.href}
      href={m.href}
      className={
        desktop
          ? `rounded-lg px-3 py-1.5 text-sm font-medium ${active(m.href) ? "bg-primary text-white" : "text-primary hover:bg-primary/5"}`
          : `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-xs font-medium ${active(m.href) ? "text-button" : "text-primary/70"}`
      }
    >
      {!desktop && <span className="text-lg">{m.icon}</span>}
      {m.label}
    </Link>
  );

  return (
    <>
      <header className="hidden items-center justify-between border-b border-black/5 bg-surface px-6 py-3 md:flex">
        <nav className="flex items-center gap-2">
          {MAIN.map((m) => item(m, true))}
          {more}
        </nav>
        <span className="text-sm text-foreground/60">{email}</span>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-black/10 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {MAIN.map((m) => item(m, false))}
        <div className="flex flex-1 justify-center">{more}</div>
      </nav>
    </>
  );
}
