import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מנוע שינוי זהות | TICO FINANCE",
  description: "אבחון עומק, הרגלי זהות ושגרה יומית של בוקר, פעולת מפתח וערב.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-32.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "מנוע שינוי" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1f3d36", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
