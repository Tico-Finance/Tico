import type { Metadata } from "next";
import { BookingButton, ThanksTracker } from "./booking-button";
import { CONTACT_PHONE_DISPLAY, WA_NUMBER } from "../consent";

export const metadata: Metadata = {
  title: "התשלום התקבל | צ'יקו פייננס",
  robots: { index: false, follow: false },
};

// עמוד החזרה מחברת הסליקה. כתובת ההחזרה בחברת הסליקה צריכה להיות:
//   https://<הדומיין>/thanks?t=<THANKS_TOKEN>
// קישור היומן (CALENDAR_URL) נשאר בשרת ומוצג רק כשהקוד ב-t תואם, כדי שלא יהיה חשוף לפני תשלום.
// Vercel env: THANKS_TOKEN (סוד ארוך), CALENDAR_URL (קישור עמוד קביעת הפגישות ביומן Google).
export default async function Thanks({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = process.env.THANKS_TOKEN ?? "";
  const calendar = process.env.CALENDAR_URL ?? "";
  const valid = token.length > 0 && t === token;
  const wa = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("היי צ'יקו, שילמתי על פגישת אסטרטגיה ואשמח לקבוע מועד.")}`;

  return (
    <div className="flex flex-1 justify-center bg-[#F5FAF7] px-4 py-8 text-[#1A1A2E]">
      <main className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#C8DDD2] bg-white p-6 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tico-finance-logo.png" alt="TICO FINANCE — אדריכל המשכנתאות" className="mx-auto h-14 w-auto" />
        {valid ? (
          <>
            <ThanksTracker />
            <h1 className="text-2xl font-bold">התשלום התקבל, תודה!</h1>
            <p className="text-sm">הצעד האחרון: בחרו מועד לפגישת האסטרטגיה.</p>
            {calendar ? (
              <BookingButton href={calendar} />
            ) : (
              <a href={wa} className="rounded-xl bg-[#25D366] px-4 py-3 text-base font-bold text-white">קבעו מועד איתי בוואטסאפ</a>
            )}
            <p className="text-xs text-[#1A1A2E]/60">אם משהו לא עובד, כתבו לי בוואטסאפ: {CONTACT_PHONE_DISPLAY}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">הקישור לא תקין</h1>
            <p className="text-sm">אם שילמתם ולא הגעתם לבחירת מועד, כתבו לי בוואטסאפ ואסדר את זה מיד.</p>
            <a href={wa} className="rounded-xl bg-[#25D366] px-4 py-3 text-base font-bold text-white">כתבו לצ'יקו בוואטסאפ</a>
          </>
        )}
      </main>
    </div>
  );
}
