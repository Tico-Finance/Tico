import type { PriorityTask } from "./priorities";

// The words of the notifications, kept apart from sending so they can be tested.

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface DigestInput {
  ranked: PriorityTask[];
  tasks: PriorityTask[];
  moneyToday: number;
}

const MONEY_MIN = 70;

/** The morning notification: the one next thing, and how much of the day is close to money. */
export function morningDigest(d: DigestInput): PushPayload {
  const focus = d.ranked[0];
  const base = { url: "/admin/home", tag: "morning" };
  if (!focus) {
    return { ...base, title: "בוקר טוב צ'יקו", body: "יום פנוי. זמן טוב לבנות: שותפים, תוכן, או משימה חשובה שנדחתה." };
  }
  const money = d.tasks.filter((t) => t.quadrant <= 2 && t.money >= MONEY_MIN).length;
  const urgent = d.tasks.filter((t) => t.quadrant === 1).length;
  const parts = [`הדבר הבא: ${focus.title}`];
  if (money > 0) parts.push(`${money} פעולות שמקרבות הכנסה`);
  if (urgent > 0) parts.push(`${urgent} דחופות`);
  return { ...base, title: "בוקר טוב צ'יקו", body: parts.join(" · ") };
}

/** Sent late in the morning, and only when nothing that moves money was done yet. */
export function moneyNudge(d: DigestInput): PushPayload | null {
  if (d.moneyToday > 0) return null;
  const t = d.ranked.find((x) => x.money >= MONEY_MIN);
  if (!t) return null;
  return { title: "עוד לא התחלת עם הכסף", body: `${t.title}. ${t.est} דקות וזה מאחוריך.`, url: t.href.startsWith("/admin") ? t.href : "/admin/home", tag: "nudge" };
}
