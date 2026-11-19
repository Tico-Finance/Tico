import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "איפיון לקוח | TICO FINANCE",
  description: "איפיון לקוח משכנתה ודוח מסודר: יכולת מימון, יחס החזר ותמהיל.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-32.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "איפיון לקוח" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#2E8B57", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
