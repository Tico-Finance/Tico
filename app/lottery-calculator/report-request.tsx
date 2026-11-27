"use client";

import { useState, type FormEvent } from "react";
import type { LotteryInput } from "@/lib/lottery-calc";
import {
  MARKETING_CONSENT_TEXT,
  REQUIRE_MARKETING_CONSENT,
} from "@/lib/calculator-lead";

type Status = "idle" | "sending" | "sent" | "error";

export default function ReportRequest({
  input,
  ready,
}: {
  input: LotteryInput;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/lottery-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, consent, website, input }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "משהו השתבש, נסו שוב.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("אין חיבור לשרת, נסו שוב.");
      setStatus("error");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-primary";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-accent/30 p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-primary">
          דוח PDF מסודר, ובנוסף הפתעה מאיתנו
        </h2>
        <p className="text-sm text-foreground/70">
          נשלח למייל דוח עם כל החישובים לפי הנתונים שהזנתם, ובנוסף תקבלו הפתעה
          מאיתנו.
        </p>
      </div>

      {status === "sent" ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-foreground/80" role="status">
          הדוח נשלח אל {email}. כדאי לבדוק גם בתיקיית הספאם / קידומי מכירות.
        </p>
      ) : !open ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!ready}
            className="rounded-full bg-button px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            שלחו לי את הדוח למייל
          </button>
          {!ready && (
            <p className="mt-2 text-xs text-foreground/60">
              הזינו קודם מחיר מוצג למ״ר כדי להפיק דוח.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
              שם מלא
              <input
                required
                minLength={2}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
              טלפון
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${inputClass} text-left`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
              אימייל
              <input
                required
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputClass} text-left`}
              />
            </label>
          </div>

          {/* honeypot - מוסתר מבני אדם */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              אתר
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={consent}
              required={REQUIRE_MARKETING_CONSENT}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>{MARKETING_CONSENT_TEXT}</span>
          </label>

          {status === "error" && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full bg-button px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "שולח..." : "שלחו לי את הדוח"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-foreground/60 underline"
            >
              ביטול
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
