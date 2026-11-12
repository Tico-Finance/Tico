"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const KEY = "tico-push-prompt-dismissed";
const subscribe = () => () => {};

function snapshot(): "show" | "hide" {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "hide";
    if (Notification.permission !== "default") return "hide";
    return localStorage.getItem(KEY) ? "hide" : "show";
  } catch {
    return "hide";
  }
}

/** A one-line invitation to turn on notifications, shown only while the phone has not decided yet. */
export default function PushPrompt() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "hide" as const);
  const [dismissed, setDismissed] = useState(false);
  if (state === "hide" || dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
      <span>רוצה שהטלפון יזכיר לך בבוקר מה הכי חשוב היום?</span>
      <span className="flex shrink-0 items-center gap-2">
        <Link href="/admin/notifications" className="rounded-lg bg-button px-3 py-1 font-medium text-white">הפעל</Link>
        <button
          onClick={() => {
            try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
            setDismissed(true);
          }}
          className="text-xs text-amber-900/70"
        >לא עכשיו</button>
      </span>
    </div>
  );
}
