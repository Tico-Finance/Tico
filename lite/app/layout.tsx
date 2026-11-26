import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "כמה משכנתה תוכלו לקבל? | צ'יקו פייננס",
  description: "בדיקה מהירה של יכולת המשכנתה שלכם, בדקה אחת. אדריכל המשכנתאות.",
  icons: { icon: "/favicon-32.png", apple: "/apple-icon.png" },
};
export const viewport: Viewport = { themeColor: "#2E8B57", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
