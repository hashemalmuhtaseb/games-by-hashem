"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import type { PointsBreakdown, RevealPayload } from "@/engine/types";
import { api } from "@/client/api";
import { Icon } from "@/components/ui/Icon";

/** Points earned this round, stated plainly: a verdict and a number. */
export function PointsPill({ points, correct }: { points: number; correct: boolean }) {
  const partial = !correct && points > 0;
  const tone = correct ? "text-good-400" : partial ? "text-fg-2" : points < 0 ? "text-bad-400" : "text-fg-3";
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className={`num display inline-flex items-baseline gap-1 text-[28px] leading-none font-semibold ${tone}`}>
      {points > 0 ? `+${points}` : points}
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
    <div className="num flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-fg-3">
      {parts.map(([k, v]) => (
        <span key={k}>
          {k} <span className="text-fg-2">{Number(v) > 0 ? "+" : ""}{v}</span>
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
  const verdict = points === undefined ? null : timedOut ? "Time's up" : correct ? "Correct" : points > 0 ? "Close" : "Not this time";
  const verdictTone = correct ? "text-good-400" : timedOut ? "text-warn-400" : points && points > 0 ? "text-fg-2" : "text-bad-400";
  return (
    <motion.section
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="card w-full max-w-2xl overflow-hidden"
    >
      {verdict && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-full bg-surface-3 ${verdictTone}`}>
              <Icon name={correct ? "check" : timedOut ? "clock" : points && points > 0 ? "minus" : "x"} size={17} strokeWidth={2.25} />
            </span>
            <div>
              <div className={`font-semibold ${verdictTone}`}>{verdict}</div>
              {breakdown && correct && <Breakdown b={breakdown} />}
            </div>
          </div>
          <PointsPill points={points ?? 0} correct={!!correct} />
        </div>
      )}
      <div className="px-5 py-5 sm:px-6">
        <div className="label">Answer</div>
        <div className="serif mt-1 text-[30px] leading-tight text-fg">{reveal.answerLabel}</div>
        {ex?.value !== undefined && (
          <div className="num mt-1 text-sm text-fg-2">
            Exact value <span className="font-medium text-fg">{ex.value.toLocaleString()}{ex.unit ? ` ${ex.unit}` : ""}</span>
          </div>
        )}
        {reveal.explanation && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">{reveal.explanation}</p>}
        {ex?.mostCommon && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="label mb-2">Most common answers</div>
              <ul className="flex flex-col">
                {ex.mostCommon.map((m) => (
                  <li key={m.name} className="flex items-baseline justify-between border-t border-line py-1.5 text-sm first:border-t-0">
                    <span className="text-fg">{m.name}</span>
                    <span className="num text-fg-3">
                      {m.percent}% · {m.points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label mb-2">Rarer answers to try</div>
              <ul className="flex flex-col">
                {ex.rareIdeas?.map((m) => (
                  <li key={m.name} className="flex items-baseline justify-between border-t border-line py-1.5 text-sm first:border-t-0">
                    <span className="text-fg">{m.name}</span>
                    <span className="num text-accent">{m.points}</span>
                  </li>
                ))}
              </ul>
              <div className="num mt-2 text-xs text-fg-3">
                {ex.validCount} valid answers · {ex.observedAnswers} recorded so far
              </div>
            </div>
          </div>
        )}
        {ex?.validExamples && (
          <p className="mt-4 text-sm leading-relaxed text-fg-3">
            Also accepted: <span className="text-fg-2">{ex.validExamples.join(", ")}</span>
            {ex.validCount && ex.validCount > ex.validExamples.length ? `, and ${ex.validCount - ex.validExamples.length} more` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-fg-3 sm:px-6">
        <span className="min-w-0 truncate">{reveal.source}</span>
        {reveal.contentKey && !reported && (
          <button className="flex shrink-0 items-center gap-1.5 transition-colors hover:text-fg" onClick={() => setReporting((r) => !r)} aria-expanded={reporting}>
            <Icon name="flag" size={13} />
            Report
          </button>
        )}
        {reported && <span className="shrink-0 text-good-400">Thanks, we&apos;ll review it.</span>}
      </div>
      {reporting && !reported && (
        <form
          className="flex gap-2 px-5 pb-4 sm:px-6"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/api/report", { body: { kind: "content", contentKey: reveal.contentKey, reason } });
              setReported(true);
              setReporting(false);
            } catch {}
          }}
        >
          <input autoFocus className="input min-h-9 py-1.5 text-sm" placeholder="What's wrong? A wrong answer, a typo…" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <button className="btn-ghost btn-sm min-h-9" disabled={reason.trim().length < 3}>
            Send
          </button>
        </form>
      )}
    </motion.section>
  );
}
