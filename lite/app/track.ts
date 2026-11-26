// מדידה: שמירת מקור התנועה (UTM / referrer) ושליחת אירועים אנונימיים.
export type Attribution = {
  source: string; medium: string; campaign: string; content: string; term: string;
  referrer: string; landing: string; sessionId: string;
};
const KEY = "tico-lite-attr-v1";

export function getAttribution(): Attribution {
  const empty: Attribution = { source: "", medium: "", campaign: "", content: "", term: "", referrer: "", landing: "", sessionId: "" };
  if (typeof window === "undefined") return empty;
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  const q = new URLSearchParams(location.search);
  let referrer = "";
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ""; } catch {}
  const a: Attribution = {
    source: q.get("utm_source") ?? "", medium: q.get("utm_medium") ?? "",
    campaign: q.get("utm_campaign") ?? "", content: q.get("utm_content") ?? "",
    term: q.get("utm_term") ?? "", referrer,
    landing: location.pathname,
    sessionId: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  };
  try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch {}
  return a;
}

export function track(event: string) {
  if (typeof window === "undefined") return;
  const a = getAttribution();
  const body = JSON.stringify({ event, ...a });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {}
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
