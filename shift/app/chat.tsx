"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_QUESTIONS, FILLER, FORMAT, HELP, REQUIRED, SECTIONS } from "./data";

type Msg = { from: "bot" | "me"; text: string };
type Props = { answers: Record<string, string>; step: number; onAnswer: (id: string, v: string, next: number) => void; onFinish: () => void };

const chip = "rounded-full border border-line bg-surface px-3 py-1.5 text-sm disabled:opacity-40";

export default function Chat({ answers, step, onAnswer, onFinish }: Props) {
  const [extras, setExtras] = useState<Record<number, Msg[]>>({});
  const [pending, setPending] = useState<Record<number, string>>({});
  const [after, setAfter] = useState<Record<number, string>>({});
  const [multi, setMulti] = useState<Record<number, boolean>>({});
  const [cleanP, setCleanP] = useState<Record<number, string>>({});
  const [follow, setFollow] = useState<Record<number, number>>({});
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const q = ALL_QUESTIONS[step];
  const last = step === ALL_QUESTIONS.length - 1;
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [step, extras, busy]);

  const push = (i: number, ...m: Msg[]) => setExtras((e) => ({ ...e, [i]: [...(e[i] ?? []), ...m] }));

  const ctx = () =>
    ["goal", "identity", "story", "reframe"].filter((k) => answers[k]).map((k) => `${k}: ${answers[k]}`).join("\n");

  async function help(kind: "explain" | "example" | "ask", free?: string) {
    const label = kind === "explain" ? "הסבר לי" : kind === "example" ? "תן דוגמה" : free!;
    push(step, { from: "me", text: label });
    setBusy(true);
    let reply = "";
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, question: q.label, text: free, context: ctx() }) });
      if (r.ok) reply = (await r.json()).text;
    } catch {}
    if (!reply) {
      const h = HELP[q.id];
      reply = kind === "explain" ? h.explain : kind === "example" ? "למשל: " + h.example : "שאלה חופשית דורשת את Gemini, והוא לא זמין כרגע. הנה ההסבר הקבוע: " + h.explain;
    }
    setBusy(false);
    push(step, { from: "bot", text: reply });
  }

  function commit(v: string, reflect?: string) {
    if (reflect) setAfter((a) => ({ ...a, [step]: reflect }));
    if (pending[step]) setMulti((m) => ({ ...m, [step]: true }));
    onAnswer(q.id, v, step + 1);
    setText("");
    if (last) onFinish();
  }

  async function send() {
    const v = text.trim();
    if (!v || busy) return;
    if (asking) { setText(""); setAsking(false); help("ask", v); return; }
    const prev = pending[step];
    const full = prev ? `${prev} ${v}` : v;
    if (q.short) { commit(full.replace(FILLER, "").replace(FILLER, "").trim()); return; }

    setBusy(true);
    let res: { intent: string; reply: string; clean: string; reflect: string; enough: boolean; followup: string } | null = null;
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "answer", question: q.label, purpose: HELP[q.id].explain, format: FORMAT[q.id], answer: full, context: ctx(), followups: follow[step] ?? 0 }) });
      if (r.ok) res = await r.json();
    } catch {}
    setBusy(false);

    if (res) {
      if (res.intent === "question") { // שאלה למאמן, לא תשובה: לא שומרים
        push(step, { from: "me", text: v }, { from: "bot", text: res.reply || "שאלה טובה. חזור לשאלה כשתרגיש מוכן לענות." });
        setText("");
        return;
      }
      const final = res.clean.trim() || full;
      if (res.enough || !res.followup) { commit(final, res.reflect); return; }
      push(step, { from: "me", text: v }, { from: "bot", text: `${res.reflect}\n${res.followup}` });
      setCleanP((c) => ({ ...c, [step]: final }));
      setPending((p) => ({ ...p, [step]: full }));
      setFollow((f) => ({ ...f, [step]: (f[step] ?? 0) + 1 }));
      setText("");
      return;
    }
    // גיבוי כשאין חיבור: העמקה קבועה לפי אורך
    const probe = HELP[q.id].probe;
    if (probe && !prev && v.length < 30) {
      push(step, { from: "me", text: v }, { from: "bot", text: probe + " (אפשר להרחיב, או ללחוץ \"זה מספיק\")" });
      setPending((p) => ({ ...p, [step]: v }));
      setText("");
      return;
    }
    commit(full);
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="mb-3">
        <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(step / ALL_QUESTIONS.length) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-muted">{step + 1}/{ALL_QUESTIONS.length}</p>
      </div>
      <div className="flex-1 space-y-3 pb-4">
        {ALL_QUESTIONS.slice(0, step + 1).map((qq, i) => {
          const sec = SECTIONS.find((s) => s.questions[0].id === qq.id);
          return (
            <div key={qq.id} className="space-y-3">
              {sec && <p className="rounded-xl bg-brand/10 p-3 text-sm leading-relaxed"><b>{sec.title}.</b> {sec.intro}</p>}
              <Bubble from="bot">{qq.label}{qq.hint && <span className="mt-1 block text-sm text-muted">{qq.hint}</span>}</Bubble>
              {(extras[i] ?? []).map((m, k) => <Bubble key={k} from={m.from}>{m.text}</Bubble>)}
              {i < step && !multi[i] && <Bubble from="me">{answers[qq.id] || "(דילגתי)"}</Bubble>}
              {i < step && after[i] && <Bubble from="bot">{after[i]}</Bubble>}
            </div>
          );
        })}
        {busy && <Bubble from="bot">…</Bubble>}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 space-y-2 bg-bg pb-3 pt-2">
        <div className="flex flex-wrap gap-2">
          <button className={chip} disabled={busy} onClick={() => help("explain")}>הסבר לי</button>
          <button className={chip} disabled={busy} onClick={() => help("example")}>תן דוגמה</button>
          <button className={`${chip} ${asking ? "border-brand font-semibold" : ""}`} onClick={() => setAsking(!asking)}>שאל שאלה</button>
          {pending[step] && <button className={chip} onClick={() => commit(cleanP[step] || pending[step])}>זה מספיק</button>}
          {!REQUIRED.has(q.id) && !pending[step] && <button className={chip} onClick={() => commit("")}>דלג</button>}
          {step > 0 && <button className={chip} onClick={() => onAnswer(ALL_QUESTIONS[step - 1].id, answers[ALL_QUESTIONS[step - 1].id] ?? "", step - 1)}>חזור</button>}
        </div>
        <div className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand"
            placeholder={asking ? "שאל את המאמן…" : q.placeholder || "התשובה שלך…"} />
          <button onClick={send} disabled={!text.trim() || busy} className="rounded-xl bg-brand px-4 font-semibold text-white disabled:opacity-40 dark:text-black">{asking ? "שאל" : last ? "סיום" : "שלח"}</button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ from, children }: { from: "bot" | "me"; children: React.ReactNode }) {
  return (
    <div className={`flex ${from === "me" ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed ${from === "me" ? "bg-brand text-white dark:text-black" : "border border-line bg-surface"}`}>{children}</div>
    </div>
  );
}
