"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import type { SessionSummary } from "@/server/solo";

export function Summary({ summary, game, variant, onAgain }: { summary: SessionSummary; game: { slug: string; name: string; icon: string }; variant: string; onAgain?: () => void }) {
  const [copied, setCopied] = useState(false);
  const pct = summary.rounds ? Math.round((summary.correct / summary.rounds) * 100) : 0;
  const share = `${game.icon} PartyVerse ${variant === "daily" ? `Daily ${new Date().toISOString().slice(0, 10)}` : game.name}: ${summary.score} pts · ${summary.correct}/${summary.rounds} correct${summary.bestStreak > 2 ? ` · 🔥${summary.bestStreak}` : ""}`;
  const p = summary.progress;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto mt-6 w-full max-w-lg">
      <div className="card overflow-hidden p-8 text-center">
        <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 50 ? "🎉" : "💪"}</div>
        <div className="label mt-4">Final score</div>
        <div className="display bg-gradient-to-r from-brand-400 to-hot-500 bg-clip-text text-7xl font-black text-transparent">{summary.score.toLocaleString()}</div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Correct" value={`${summary.correct}/${summary.rounds}`} />
          <Stat label="Best streak" value={`🔥 ${summary.bestStreak}`} />
          <Stat label="XP" value={p ? `+${p.xpGained}` : "—"} />
        </div>
        {p?.leveledUp && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }} className="mt-5 rounded-xl bg-brand-500/20 px-4 py-3 font-bold text-brand-400">
            ⭐ Level up! You&apos;re now level {p.level}
          </motion.div>
        )}
        {p?.personalBest && summary.rounds > 0 && <div className="mt-3 text-sm font-semibold text-good-400">New personal best!</div>}
        {summary.rating && (
          <div className="mt-3 text-sm">
            Rating <b className="text-white">{summary.rating.rating}</b>{" "}
            <span className={summary.rating.delta >= 0 ? "text-good-400" : "text-bad-400"}>
              ({summary.rating.delta >= 0 ? "+" : ""}
              {summary.rating.delta})
            </span>
          </div>
        )}
        {summary.dailyRank && <div className="mt-3 text-sm text-ink-300">You&apos;re <b className="text-white">#{summary.dailyRank}</b> on today&apos;s leaderboard</div>}
        {p && p.newAchievements.length > 0 && (
          <div className="mt-5">
            <div className="label mb-2">Achievements unlocked</div>
            <div className="flex flex-wrap justify-center gap-2">
              {p.newAchievements.map((a, i) => (
                <motion.span key={a.slug} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 + i * 0.1 }} className="chip border-warn-400/40 px-3 py-1 text-sm text-warn-400">
                  {a.icon} {a.name}
                </motion.span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-2">
          {onAgain && (
            <button className="btn-primary py-3" onClick={onAgain}>
              Play again
            </button>
          )}
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(share);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? "Copied!" : "📋 Share result"}
            </button>
            <Link href={variant === "daily" ? "/leaderboard?board=daily" : `/games/${game.slug}`} className="btn-ghost flex-1">
              {variant === "daily" ? "Leaderboard" : "Change mode"}
            </Link>
          </div>
          <Link href="/" className="mt-2 text-sm text-ink-400 hover:text-white">
            Back to all games
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <div className="display text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-ink-400">{label}</div>
    </div>
  );
}
