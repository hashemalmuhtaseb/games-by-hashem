"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import type { PointsBreakdown, RevealPayload } from "@/engine/types";
import { api } from "@/client/api";
import { formatNumber } from "@/engine/closest";

export function PointsPill({ points, correct }: { points: number; correct: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`display inline-flex items-center gap-2 rounded-full px-5 py-2 text-2xl font-black ${correct ? "bg-good-500/20 text-good-400" : points < 0 ? "bg-bad-500/20 text-bad-400" : "bg-white/10 text-ink-300"}`}
    >
      {correct ? "✓" : points > 0 ? "≈" : "✗"} {points > 0 ? `+${points}` : points}
    </motion.div>
  );
}

export function Breakdown({ b }: { b: PointsBreakdown }) {
  const parts = [
    ["Base", b.base],
    ["Speed", b.speed],
    ["Difficulty", b.difficulty],
    ["Streak", b.streak],
    ...(b.rarity ? [["Rarity", b.rarity] as const] : []),
  ].filter(([, v]) => v);
  if (!parts.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {parts.map(([k, v]) => (
        <span key={k} className="chip">
          {k} {Number(v) > 0 ? "+" : ""}
          {v}
        </span>
      ))}
    </div>
  );
}

export function RevealPanel({ reveal, points, correct, breakdown, timedOut }: { reveal: RevealPayload; points?: number; correct?: boolean; breakdown?: PointsBreakdown; timedOut?: boolean }) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reason, setReason] = useState("");
  const ex = reveal.extra as
    | {
        mostCommon?: { name: string; points: number; percent: number }[];
        rareIdeas?: { name: string; points: number }[];
        validCount?: number;
        observedAnswers?: number;
        validExamples?: string[];
        value?: number;
        unit?: string;
      }
    | undefined;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card w-full max-w-2xl p-5 text-center">
      {points !== undefined && (
        <div className="mb-3 flex flex-col items-center gap-2">
          {timedOut && <div className="text-sm font-semibold text-warn-400">⏰ Time&apos;s up</div>}
          <PointsPill points={points} correct={!!correct} />
          {breakdown && correct && <Breakdown b={breakdown} />}
        </div>
      )}
      <div className="label">Answer</div>
      <div className="display mt-1 text-2xl font-bold text-white">{reveal.answerLabel}</div>
      {ex?.value !== undefined && (
        <div className="mt-1 text-ink-300">
          Exact value: <b className="text-white">{formatNumber(ex.value, ex.unit)}{ex.unit ? ` ${ex.unit}` : ""}</b>
        </div>
      )}
      {reveal.explanation && <p className="mx-auto mt-2 max-w-xl text-sm text-ink-300">{reveal.explanation}</p>}
      {ex?.mostCommon && (
        <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
          <div>
            <div className="label mb-1">Most common answers</div>
            {ex.mostCommon.map((m) => (
              <div key={m.name} className="flex justify-between text-sm">
                <span className="text-ink-100">{m.name}</span>
                <span className="text-ink-400 tabular-nums">{m.percent}% · {m.points}pts</span>
              </div>
            ))}
          </div>
          <div>
            <div className="label mb-1">Rare ideas you could try</div>
            {ex.rareIdeas?.map((m) => (
              <div key={m.name} className="flex justify-between text-sm">
                <span className="text-ink-100">{m.name}</span>
                <span className="text-brand-400 tabular-nums">{m.points}pts</span>
              </div>
            ))}
            <div className="mt-1 text-xs text-ink-400">
              {ex.validCount} valid answers · {ex.observedAnswers} answers recorded so far
            </div>
          </div>
        </div>
      )}
      {ex?.validExamples && (
        <div className="mt-3 text-sm text-ink-300">
          <span className="label">Other valid answers:</span> {ex.validExamples.join(", ")}
          {ex.validCount && ex.validCount > ex.validExamples.length ? ` … (${ex.validCount} in total)` : ""}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-400">
        <span className="text-left">{reveal.source}</span>
        {reveal.contentKey && !reported && (
          <button className="shrink-0 hover:text-white" onClick={() => setReporting((r) => !r)}>
            ⚑ Report a problem
          </button>
        )}
        {reported && <span className="shrink-0 text-good-400">Thanks — we&apos;ll review it.</span>}
      </div>
      {reporting && !reported && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/api/report", { body: { kind: "content", contentKey: reveal.contentKey, reason } });
              setReported(true);
              setReporting(false);
            } catch {}
          }}
        >
          <input className="input py-2 text-sm" placeholder="What's wrong? (wrong answer, typo, offensive…)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <button className="btn-ghost text-sm" disabled={reason.trim().length < 3}>
            Send
          </button>
        </form>
      )}
    </motion.div>
  );
}
