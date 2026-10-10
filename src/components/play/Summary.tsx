"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import type { SessionSummary } from "@/server/solo";
import { CountUp } from "@/components/ui/CountUp";
import { Icon } from "@/components/ui/Icon";

const rise = (d: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.36, ease: [0.2, 0.8, 0.2, 1] as const } });

export function Summary({ summary, game, variant, onAgain }: { summary: SessionSummary; game: { slug: string; name: string; icon: string }; variant: string; onAgain?: () => void }) {
  const [copied, setCopied] = useState(false);
  const pct = summary.rounds ? Math.round((summary.correct / summary.rounds) * 100) : 0;
  const share = `PartyVerse ${variant === "daily" ? `Daily ${new Date().toISOString().slice(0, 10)}` : game.name}: ${summary.score} pts · ${summary.correct}/${summary.rounds} correct${summary.bestStreak > 2 ? ` · streak ${summary.bestStreak}` : ""}`;
  const p = summary.progress;
  const headline = pct >= 90 ? "Flawless form." : pct >= 70 ? "Strong game." : pct >= 40 ? "Solid effort." : "Tough set.";
  return (
    <div className="mx-auto mt-10 w-full max-w-lg pb-10">
      <motion.div {...rise(0)} className="text-center">
        <div className="overline">{variant === "daily" ? "Daily challenge" : game.name}</div>
        <h1 className="serif mt-3 text-[40px] leading-tight text-fg">{headline}</h1>
      </motion.div>

      <motion.div {...rise(0.08)} className="mt-8 text-center">
        <CountUp value={summary.score} duration={900} className="display num block text-[88px] leading-none font-semibold tracking-[-0.04em] text-fg" />
        <div className="mt-2 text-sm text-fg-3">points</div>
      </motion.div>

      <motion.dl {...rise(0.16)} className="num mt-10 grid grid-cols-3 border-y border-line">
        <Stat label="Correct" value={`${summary.correct}/${summary.rounds}`} />
        <Stat label="Best streak" value={String(summary.bestStreak)} border />
        <Stat label="XP earned" value={p ? `+${p.xpGained}` : "—"} border />
      </motion.dl>

      {(p?.leveledUp || (p?.personalBest && summary.rounds > 0) || summary.rating || summary.dailyRank) && (
        <motion.ul {...rise(0.24)} className="mt-6 flex flex-col gap-2">
          {p?.leveledUp && (
            <Note icon="star" tone="text-accent">
              Level up. You&apos;re now level <span className="num">{p.level}</span>.
            </Note>
          )}
          {p?.personalBest && summary.rounds > 0 && (
            <Note icon="trophy" tone="text-good-400">
              New personal best.
            </Note>
          )}
          {summary.rating && (
            <Note icon="chart" tone="text-fg-2">
              Rating <span className="num font-medium text-fg">{summary.rating.rating}</span>{" "}
              <span className={`num ${summary.rating.delta >= 0 ? "text-good-400" : "text-bad-400"}`}>
                {summary.rating.delta >= 0 ? "+" : "−"}
                {Math.abs(summary.rating.delta)}
              </span>
            </Note>
          )}
          {summary.dailyRank && (
            <Note icon="calendar" tone="text-fg-2">
              <span className="num font-medium text-fg">#{summary.dailyRank}</span> on today&apos;s leaderboard.
            </Note>
          )}
        </motion.ul>
      )}

      {p && p.newAchievements.length > 0 && (
        <motion.div {...rise(0.3)} className="mt-8">
          <div className="label mb-3">Unlocked</div>
          <ul className="flex flex-col gap-2">
            {p.newAchievements.map((a, i) => (
              <motion.li key={a.slug} {...rise(0.36 + i * 0.06)} className="well flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden>
                  {a.icon}
                </span>
                <span className="font-medium text-fg">{a.name}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div {...rise(0.34)} className="mt-10 flex flex-col gap-2">
        {onAgain && (
          <button autoFocus className="btn-primary btn-lg" onClick={onAgain}>
            <Icon name="refresh" size={17} />
            Play again
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {}
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? "Copied" : "Copy result"}
          </button>
          <Link href={variant === "daily" ? "/leaderboard?board=daily" : `/games/${game.slug}`} className="btn-ghost">
            {variant === "daily" ? "Leaderboard" : "Change mode"}
          </Link>
        </div>
        <Link href="/" className="btn-quiet btn-sm mx-auto mt-3">
          Back to the library
        </Link>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`py-5 text-center ${border ? "border-l border-line" : ""}`}>
      <dd className="display text-2xl font-semibold text-fg">{value}</dd>
      <dt className="mt-1 text-xs text-fg-3">{label}</dt>
    </div>
  );
}

function Note({ icon, tone, children }: { icon: "star" | "trophy" | "chart" | "calendar"; tone: string; children: React.ReactNode }) {
  return (
    <li className="well flex items-center gap-3 px-4 py-3 text-sm text-fg-2">
      <Icon name={icon} size={17} className={tone} />
      <span>{children}</span>
    </li>
  );
}
