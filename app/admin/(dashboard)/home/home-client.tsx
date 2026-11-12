"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { CalendarEvent, CalendarResult } from "@/lib/calendar";
import { STAGE_LABELS, TYPE_LABELS, whatsappLink } from "@/lib/leads";
import type { DayEntry, PlanSettings } from "@/lib/business-plan/types";
import { defaultSettings } from "@/lib/business-plan/defaults";
import { buildParams, buildPlan } from "@/lib/business-plan/model";
import { buildVerdict, statusOf, watchRows } from "@/lib/business-plan/forecast";
import { dk, pdt } from "@/lib/business-plan/dates";
import { planStartOf, yearSettings } from "@/lib/business-plan/targets";
import WeekGoals from "../week-goals";
import { dec, money, nf, cnt } from "@/lib/business-plan/format";
import type { LeadRow } from "../leads/leads-board";
import DayMatrix, { type MatrixProps } from "./day-matrix";
import PushPrompt from "./push-prompt";

const noopSubscribe = () => () => {};
const isOpen = (s: LeadRow["stage"]) => s !== "client" && s !== "lost";

const card = "rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5";
const TONE = { good: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-rose-500" } as const;

export default function HomeClient(props: {
  leads: LeadRow[];
  settings: PlanSettings | null;
  days: Record<string, DayEntry>;
  calendar: CalendarResult;
  matrix: MatrixProps;
}) {
  // "Today" only exists on the client (the server may be in another timezone).
  const todayKey = useSyncExternalStore(noopSubscribe, () => dk(new Date()), () => null);
  if (todayKey === null) return <div className="py-10 text-center text-foreground/50">טוען…</div>;
  return <Home {...props} today={pdt(todayKey)} />;
}

function Home({ leads, settings, days, calendar, matrix, today }: {
  leads: LeadRow[];
  settings: PlanSettings | null;
  days: Record<string, DayEntry>;
  calendar: CalendarResult;
  matrix: MatrixProps;
  today: Date;
}) {
  const dayStart = today.getTime();
  const dayEnd = dayStart + 864e5;

  const meetings = useMemo(() => {
    const open = leads.filter((l) => isOpen(l.stage) && l.nextAt);
    const t = (l: LeadRow) => new Date(l.nextAt as string).getTime();
    return open.filter((l) => t(l) < dayEnd && l.stage === "meeting" && t(l) >= dayStart).sort((a, b) => t(a) - t(b));
  }, [leads, dayStart, dayEnd]);

  const todayKey = dk(today);
  const events = useMemo(() => {
    if (calendar.status !== "ok") return [];
    return calendar.events.filter((e) =>
      e.allDay ? e.dayKey === todayKey : new Date(e.start).getTime() < dayEnd && new Date(e.end).getTime() > dayStart,
    );
  }, [calendar, todayKey, dayStart, dayEnd]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">{greeting}, צ׳יקו</h1>
        <p className="text-sm text-foreground/60">
          {today.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <section className={card}>
        <Head title="פגישות היום" count={meetings.length + events.length} href="/admin/leads" />
        {meetings.length + events.length === 0 ? (
          <Empty text="אין פגישות מתוכננות להיום." />
        ) : (
          <ul className="divide-y divide-black/5">
            {events.map((e) => <EventItem key={e.id} e={e} />)}
            {meetings.map((l) => <LeadItem key={l.id} l={l} showTime />)}
          </ul>
        )}
        {calendar.status === "off" && (
          <p className="mt-2 text-xs text-foreground/50">היומן של גוגל עוד לא מחובר, ולכן מוצגות רק פגישות שהוכנסו כלידים.</p>
        )}
        {calendar.status === "error" && (
          <p className="mt-2 text-xs text-rose-600">לא הצלחתי לקרוא את היומן של גוגל כרגע.</p>
        )}
      </section>

      <PushPrompt />
      <DayMatrix {...matrix} />

      {matrix.planYear !== null && <WeekGoals rows={matrix.weekGoals} year={matrix.planYear} />}

      <Target settings={settings} days={days} today={today} year={matrix.planYear ?? today.getFullYear()} />
    </div>
  );
}

function Head({ title, count, href }: { title: string; count: number; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-semibold text-primary">
        {title}
        <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">{count}</span>
      </h2>
      <Link href={href} className="text-sm text-secondary">לכל הלידים</Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-foreground/50">{text}</p>;
}

function EventItem({ e }: { e: CalendarEvent }) {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="font-medium">
          {e.title}
          <span className="mr-2 text-xs font-normal text-foreground/50">יומן</span>
        </div>
        {e.location && <div className="truncate text-sm text-foreground/70">{e.location}</div>}
      </div>
      <span dir="ltr" className="shrink-0 text-sm text-foreground/60">
        {e.allDay ? "כל היום" : `${fmt(e.start)}–${fmt(e.end)}`}
      </span>
    </li>
  );
}

function LeadItem({ l, showTime, overdue }: { l: LeadRow; showTime?: boolean; overdue?: boolean }) {
  const wa = whatsappLink(l.phone);
  const at = l.nextAt ? new Date(l.nextAt) : null;
  const timed = at && (at.getHours() !== 9 || at.getMinutes() !== 0);
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="font-medium">
          {l.name}
          <span className="mr-2 text-xs font-normal text-foreground/50">
            {TYPE_LABELS[l.type]} · {STAGE_LABELS[l.stage]}
          </span>
        </div>
        {l.nextStep && <div className="truncate text-sm text-foreground/70">{l.nextStep}</div>}
        {overdue && at && (
          <div className="text-xs text-rose-600">באיחור מאז {at.toLocaleDateString("he-IL")}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        {showTime && timed && at && (
          <span className="text-foreground/60">{at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white">
            וואטסאפ
          </a>
        )}
      </div>
    </li>
  );
}

function Target({ settings, days, today, year }: { settings: PlanSettings | null; days: Record<string, DayEntry>; today: Date; year: number }) {
  const model = useMemo(() => {
    const S = yearSettings(settings ?? defaultSettings(new Date(year, 0, 1)));
    const ps = planStartOf(S, year);
    const plans = [0.5, 1, 1.5].map((k) => buildPlan(buildParams(S, ps), k));
    return { ps, plans };
  }, [settings, year]);

  if (!settings?.done) {
    return (
      <section className={card}>
        <h2 className="mb-1 font-semibold text-primary">מצב מול היעד</h2>
        <p className="mb-3 text-sm text-foreground/60">עוד לא בנית תוכנית. כמה שאלות קצרות והמערכת תראה לך כאן איפה אתה עומד.</p>
        <Link href="/admin/plan" className="inline-block rounded-xl bg-button px-4 py-2 text-sm font-medium text-white">
          לבניית התוכנית
        </Link>
      </section>
    );
  }

  const { ps, plans } = model;
  const { rows, label } = watchRows(plans[1], days, "month", today, ps);
  const has = Object.keys(days).length > 0;
  const vd = has ? buildVerdict(plans, days, today, ps) : null;

  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-primary">מצב מול היעד · {label}</h2>
        <Link href="/admin/plan" className="text-sm text-secondary">לתוכנית</Link>
      </div>
      {!has ? (
        <p className="text-sm text-foreground/60">
          עוד אין דיווחים. מלא דיווח יומי בתוכנית כדי לראות כאן התקדמות מול היעד.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="text-foreground/70">
                    {r.key === "income" ? `${money(r.act)} מתוך ${money(r.plan)}` : `${cnt(r.act)} מתוך ${cnt(r.plan)}`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${TONE[statusOf(r.ratio)]}`} style={{ width: `${Math.min(100, Math.round(r.ratio * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {vd && (
            <p className="mt-4 rounded-xl bg-primary/5 p-3 text-sm">
              בקצב הנוכחי תסיים את השנה עם כ-{cnt(vd.final)} תיקים, {nf(vd.ratio * 100)}% מהיעד ({vd.near}).
              {vd.needPerMonth > 0 && <> כדי להגיע ליעד נדרשים כ-{cnt(vd.needPerMonth)} תיקים בחודש.</>}
            </p>
          )}
        </>
      )}
    </section>
  );
}
