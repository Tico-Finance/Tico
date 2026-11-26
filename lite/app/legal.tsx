import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 justify-center bg-[#F5FAF7] px-4 py-8 text-[#1A1A2E]">
      <main className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-6 text-sm leading-relaxed shadow-sm">
        <Link href="/" className="text-xs underline">חזרה למחשבון</Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-xs text-[#1A1A2E]/60">עודכן לאחרונה: {updated}</p>
        {children}
      </main>
    </div>
  );
}
export const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mt-2 text-base font-bold">{children}</h2>;
