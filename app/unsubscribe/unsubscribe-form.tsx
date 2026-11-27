"use client";

import { useState, useTransition } from "react";
import { confirmUnsubscribeAction } from "./actions";
import {
  UNSUBSCRIBE_OTHER_KEY,
  UNSUBSCRIBE_REASONS,
} from "@/lib/unsubscribe-reasons";

export default function UnsubscribeForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; email?: string } | null>(null);

  const toggle = (key: string) =>
    setReasons((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const otherChecked = reasons.includes(UNSUBSCRIBE_OTHER_KEY);

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-medium text-emerald-700">
          הוסרת בהצלחה מרשימת התפוצה. לא יישלחו אליך עוד מיילים שיווקיים.
        </p>
        <p className="text-sm text-foreground/70">תודה על המשוב, והמשך יום מצוין.</p>
      </div>
    );
  }
  if (result && !result.ok) {
    return <p className="text-button">הקישור אינו תקין או שכבר נעשה בו שימוש.</p>;
  }

  return (
    <form
      className="flex flex-col gap-4 text-right"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setResult(await confirmUnsubscribeAction(token, reasons, note));
        });
      }}
    >
      <p className="text-center font-medium">
        אוי! אנחנו מצטערים שהחלטת להסיר את הרשמתך מהרשימה.
      </p>
      <p className="text-sm text-foreground/70">נשמח לדעת מה הסיבה (אפשר לדלג):</p>

      <div className="flex flex-col gap-2">
        {UNSUBSCRIBE_REASONS.map((r) => (
          <label key={r.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reasons.includes(r.key)}
              onChange={() => toggle(r.key)}
              className="h-4 w-4"
            />
            {r.label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={otherChecked}
            onChange={() => toggle(UNSUBSCRIBE_OTHER_KEY)}
            className="h-4 w-4"
          />
          אחר
        </label>
        {otherChecked && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="ספרו לנו במילים שלכם"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-center rounded-full bg-button px-6 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "מסיר..." : "הסירו אותי מהרשימה"}
      </button>
    </form>
  );
}
