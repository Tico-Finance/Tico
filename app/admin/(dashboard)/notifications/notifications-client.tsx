"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendMorningPreviewAction, sendTestPushAction } from "./actions";

interface Device {
  endpoint: string;
  userAgent: string;
  createdAt: string;
}

const btn = "rounded-xl bg-button px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const ghost = "rounded-xl border border-black/10 px-4 py-2 text-sm text-primary hover:bg-primary/5 disabled:opacity-50";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const deviceName = (ua: string) =>
  /SM-S9|SM-|Samsung/i.test(ua) ? "Samsung" : /iPhone/i.test(ua) ? "iPhone" : /Android/i.test(ua) ? "Android" : /Windows|Macintosh|Linux/i.test(ua) ? "מחשב" : "מכשיר";

export default function NotificationsClient({ publicKey, devices: initial }: { publicKey: string; devices: Device[] }) {
  const [devices, setDevices] = useState(initial);
  const [here, setHere] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (live) setPermission("unsupported");
        return;
      }
      if (live) setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (live) setHere(sub?.endpoint ?? null);
    })();
    return () => { live = false; };
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMsg("ההרשאה לא ניתנה. אפשר לאשר אותה בהגדרות האתר בדפדפן.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setHere(sub.endpoint);
      setDevices((d) => [{ endpoint: sub.endpoint, userAgent: navigator.userAgent, createdAt: new Date().toISOString() }, ...d.filter((x) => x.endpoint !== sub.endpoint)]);
      setMsg("ההתראות הופעלו במכשיר הזה. לחץ \"שלח התראת ניסיון\".");
    } catch (e) {
      setMsg(e instanceof Error ? `לא הצלחתי להפעיל: ${e.message}` : "לא הצלחתי להפעיל");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? here;
      await sub?.unsubscribe();
      if (endpoint) {
        await removePushSubscriptionAction(endpoint);
        setDevices((d) => d.filter((x) => x.endpoint !== endpoint));
      }
      setHere(null);
      setMsg("ההתראות כובו במכשיר הזה.");
    } finally {
      setBusy(false);
    }
  }

  async function send(kind: "test" | "morning") {
    setBusy(true);
    setMsg("");
    const res = kind === "test" ? await sendTestPushAction() : await sendMorningPreviewAction();
    setBusy(false);
    if (!res.ok) return setMsg(res.error);
    if (res.sent === 0) return setMsg(res.removed ? "המכשיר כבר לא רשום, הפעל התראות מחדש." : res.failed ? "השליחה נכשלה. נסה שוב בעוד רגע." : "אין מכשיר רשום. הפעל התראות קודם.");
    setMsg(`נשלח ל-${res.sent} מכשירים. ההתראה אמורה להגיע תוך שניות.`);
  }

  const status = permission === "unsupported" ? "הדפדפן הזה לא תומך בהתראות" : here ? "פעילות במכשיר הזה" : permission === "denied" ? "חסומות בדפדפן" : "כבויות במכשיר הזה";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">התראות</h1>
          <p className="text-sm text-foreground/60">מה לעשות היום, ישר לטלפון.</p>
        </div>
        <Link href="/admin/home" className="text-sm text-secondary">חזרה ליום</Link>
      </div>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-primary">המכשיר הזה</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${here ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!here && permission !== "unsupported" && permission !== "denied" && <button className={btn} disabled={busy} onClick={enable}>הפעל התראות במכשיר הזה</button>}
          {here && <button className={btn} disabled={busy} onClick={() => send("test")}>שלח התראת ניסיון</button>}
          {here && <button className={ghost} disabled={busy} onClick={() => send("morning")}>שלח את התראת הבוקר עכשיו</button>}
          {here && <button className={ghost} disabled={busy} onClick={disable}>כבה במכשיר הזה</button>}
        </div>
        {permission === "denied" && <p className="mt-3 text-sm text-rose-700">ההתראות חסומות לאתר הזה. ב-Chrome: סמל המנעול ליד הכתובת ← הרשאות ← התראות ← אפשר.</p>}
        {permission === "unsupported" && <p className="mt-3 text-sm text-foreground/70">אפשר להפעיל התראות מ-Chrome או מ-Samsung Internet בטלפון.</p>}
        {msg && <p className="mt-3 rounded-lg bg-primary/5 p-2 text-sm">{msg}</p>}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-semibold text-primary">מה יגיע</h2>
        <ul className="space-y-2 text-sm">
          <li><b>הודעת בוקר</b> (ראשון עד חמישי, בערך 07:00–08:00): הדבר הבא שכדאי לעשות, וכמה פעולות קרובות להכנסה מחכות.</li>
          <li><b>תזכורת כסף</b> (בערך 10:00–11:00): רק אם עוד לא עשית היום שום דבר שמקרב הכנסה.</li>
        </ul>
        <p className="mt-2 text-xs text-foreground/50">השעות מדויקות בטווח של כשעה. לחיצה על ההתראה פותחת את האפליקציה.</p>
      </section>

      {devices.length > 0 && (
        <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-2 font-semibold text-primary">מכשירים רשומים</h2>
          <ul className="divide-y divide-black/5 text-sm">
            {devices.map((d) => (
              <li key={d.endpoint} className="flex items-center justify-between py-2">
                <span>{deviceName(d.userAgent)}{d.endpoint === here ? " (זה)" : ""}</span>
                <span className="text-xs text-foreground/50">{new Date(d.createdAt).toLocaleDateString("he-IL")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
