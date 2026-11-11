import type { CSSProperties } from "react";
import type { Metadata } from "next";
import SmartMortgageCalculator from "./smart-mortgage-calculator";

export const metadata: Metadata = {
  title: "מחשבון משכנתה חכם | Tico",
  description:
    "הזינו נתוני הכנסות, התחייבויות וסוג עסקה, וקבלו חישוב אוטומטי של יחס החזר, סך הכנסות, הכנסה פנויה ומשכנתה מקסימלית.",
  // manifest ייעודי לעמוד הזה (לא זה של האפליקציה הראשית) - כדי
  // שאפשר יהיה "להוריד" (להוסיף למסך הבית) את מחשבון המשכנתה בפני
  // עצמו, עם הלוגו של Tico.
  manifest: "/mortgage-calculator-manifest.webmanifest",
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "מחשבון משכנתה",
  },
};

// פלטת המותג האמיתית של Tico - זהה בכל הכלים הפיננסיים (tico-finance,
// tico-annual-report) - ולא ה-primary/button/bg הישנים (כחול/אדום/
// ירוק-בהיר) שהגיעו מהמחשבון הישן. מוגדר מקומית לעמוד הזה בלבד, בלי
// לגעת בטוקנים הגלובליים ששאר האתר (lottery-calculator וכו') תלוי בהם.
// הכלים הפיננסיים האמיתיים לא תומכים ב-dark mode אוטומטי ("Always use
// the light/green brand palette" - כלשונו של tico-finance) - לכן
// צריך לקבע גם את surface (לא רק bg/text), אחרת ה-media query הגלובלי
// של Tico הופך כרטיסים לכהים תוך כדי שהטקסט הכהה שלנו נשאר כהה.
const BRAND_STYLE = {
  "--brand-primary": "#2E8B57",
  "--brand-button": "#2E8B57",
  "--brand-bg": "#F5FAF7",
  "--brand-text": "#1A1A2E",
  "--surface": "#FFFFFF",
  "--tico-good": "#2E8B57",
  "--tico-good-soft": "rgba(46,139,87,.11)",
  "--tico-warn": "#B8860B",
  "--tico-warn-soft": "rgba(184,134,11,.13)",
  "--tico-critical": "#C0392B",
  "--tico-critical-soft": "rgba(192,57,43,.11)",
  "--tico-line": "#C8DDD2",
  "--tico-line-strong": "#AFCDBF",
  "--tico-shadow": "0 1px 2px rgba(15,36,62,.04), 0 10px 26px rgba(15,36,62,.07)",
} as CSSProperties;

export default function MortgageCalculatorPage() {
  return (
    <div
      className="flex flex-1 justify-center bg-background px-4 py-10 print:py-2"
      style={BRAND_STYLE}
    >
      <main className="flex w-full max-w-4xl flex-col gap-6 print:gap-1">
        <header className="flex flex-col gap-2 text-center print:gap-0.5">
          <p className="text-sm font-semibold text-primary print:text-[9px]">
            Tico Finance
          </p>
          <h1 className="text-2xl font-semibold text-foreground print:text-sm">
            מחשבון משכנתה חכם
          </h1>
          <p className="text-foreground/80 print:hidden">
            הזינו את פרטי העסקה, ההכנסות וההתחייבויות, והמחשבון יחשב עבורכם
            אוטומטית יחס החזר, סך הכנסות, הכנסה פנויה ומשכנתה מקסימלית -
            בהתאם לכללי המימון של בנק ישראל.
          </p>
          <div className="mx-auto h-px w-16 bg-primary" />
        </header>
        <SmartMortgageCalculator />
      </main>
    </div>
  );
}
