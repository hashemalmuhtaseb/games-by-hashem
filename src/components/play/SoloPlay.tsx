"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, PointsBreakdown, RevealPayload } from "@/engine/types";
import type { RoundView, SessionSummary, ActView } from "@/server/solo";
import { api } from "@/client/api";
import { play } from "@/client/sound";
import { burst } from "@/client/confetti";
import { useMe } from "@/client/me";
import { RoundPlayer, TimerBar, type ActResponse } from "./Round";
import { RevealPanel } from "./Reveal";
import { Summary } from "./Summary";
import { CountUp } from "@/components/ui/CountUp";
import { GameGlyph } from "@/components/ui/GameGlyph";
import { Icon } from "@/components/ui/Icon";
import { plainLabel } from "@/components/ui/text";

type Variant = "classic" | "survival" | "ranked" | "chaos" | "daily";
interface GameLite {
  slug: string;
  name: string;
  icon: string;
  accent: [string, string];
  group?: string;
}

export function SoloPlay({ game, variant, modes }: { game: GameLite; variant: Variant; modes?: string[] }) {
  const { refresh } = useMe();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<RoundView | null>(null);
  const [offset, setOffset] = useState(0);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [result, setResult] = useState<{ points: number; correct: boolean; breakdown?: PointsBreakdown; timedOut?: boolean } | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState<number | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const started = useRef(false);

  const applyView = useCallback((v: RoundView | { finished: true; summary: SessionSummary }) => {
    if ("finished" in v) {
      setSummary(v.summary);
      setView(null);
      play(v.summary.correct > v.summary.rounds / 2 ? "win" : "reveal");
      if (v.summary.correct >= v.summary.rounds * 0.7) burst("big");
      void refresh();
      return;
    }
    setOffset(v.serverNow - Date.now());
    setView(v);
    setReveal(null);
    setResult(null);
    setScore(v.score);
    setStreak(v.streak);
    setLives(v.lives);
  }, [refresh]);

  const start = useCallback(async () => {
    setError(null);
    setSummary(null);
    try {
      const r = await api<{ sessionId: string; view: RoundView | { finished: true; summary: SessionSummary } }>("/api/play/start", { body: { game: game.slug, modes, variant } });
      setSessionId(r.sessionId);
      play("start");
      applyView(r.view);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [game.slug, modes, variant, applyView]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const settle = useCallback((r: ActView) => {
    setScore(r.score);
    setStreak(r.streak);
    setLives(r.lives);
    if (r.done && r.answer) {
      setReveal(r.answer);
      setResult({ points: r.points ?? 0, correct: !!r.correct, breakdown: r.breakdown, timedOut: r.timedOut });
      if (r.correct) {
        play(r.streak >= 3 && r.streak % 3 === 0 ? "streak" : "correct");
        if (r.streak > 0 && r.streak % 5 === 0) burst("small");
      } else play("wrong");
    }
  }, []);

  const act = useCallback(
    async (a: Action): Promise<ActResponse | null> => {
      if (!sessionId || !view) return null;
      try {
        const r = await api<ActView>("/api/play/act", { body: { sessionId, roundId: view.round.roundId, action: a } });
        settle(r);
        return r as ActResponse;
      } catch (e) {
        const msg = (e as Error).message;
        if (/expired/i.test(msg)) setError(msg);
        return { error: msg, done: false };
      }
    },
    [sessionId, view, settle],
  );

  const onTimeUp = useCallback(async () => {
    if (!sessionId || !view || reveal) return;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await api<ActView>("/api/play/timeout", { body: { sessionId, roundId: view.round.roundId } });
        settle(r);
        return;
      } catch (e) {
        if (!/not up yet/.test((e as Error).message)) return;
        await new Promise((res) => setTimeout(res, 600));
      }
    }
  }, [sessionId, view, reveal, settle]);

  const next = useCallback(async () => {
    if (!sessionId || loadingNext) return;
    setLoadingNext(true);
    try {
      const r = await api<{ view: RoundView | { finished: true; summary: SessionSummary } }>("/api/play/next", { body: { sessionId } });
      applyView(r.view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingNext(false);
    }
  }, [sessionId, loadingNext, applyView]);

  const quit = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await api<{ summary: SessionSummary }>("/api/play/quit", { body: { sessionId } });
      applyView({ finished: true, summary: r.summary });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId, applyView]);

  useEffect(() => {
    if (!reveal) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLInputElement)) void next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [reveal, next]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="sticky top-0 z-30 -mx-5 bg-canvas/90 px-5 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex h-16 items-center gap-3">
          <Link href={game.slug === "roulette" && variant === "daily" ? "/" : `/games/${game.slug}`} className="btn-icon -ml-2" aria-label="Leave game">
            <Icon name="x" size={20} />
          </Link>
          <GameGlyph slug={game.slug} group={game.group} name={game.name} size={32} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-semibold text-fg">{game.name}</div>
            <div className="num truncate text-[13px] text-fg-3">
              {variant === "daily" ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : VARIANT_LABEL[variant]}
              {view && ` · Round ${view.index + 1}${view.total ? ` of ${view.total}` : ""}`}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {streak >= 2 && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="num flex items-center gap-1 text-sm font-medium text-warn-400" aria-label={`Streak ${streak}`}>
                  <Icon name="flame" size={16} />
                  {streak}
                </motion.span>
              )}
            </AnimatePresence>
            {lives !== null && (
              <span className="flex gap-1" aria-label={`${lives} lives left`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <Icon key={i} name="heart" size={16} className={`transition-colors duration-300 ${i < lives ? "fill-bad-400 text-bad-400" : "text-fg-4"}`} />
                ))}
              </span>
            )}
            <div className="text-right">
              <CountUp value={score} className="display num block text-[22px] leading-none font-semibold text-fg" />
              <span className="text-[11px] text-fg-3">points</span>
            </div>
            {view && !summary && (
              <button onClick={quit} className="btn-quiet btn-sm -mr-2 hidden sm:inline-flex">
                End
              </button>
            )}
          </div>
        </div>
        {view && !summary && (
          <div className="pb-2">
            <TimerBar deadline={view.deadline} offset={offset} total={view.round.timeLimitSec} onZero={onTimeUp} stopped={!!reveal} />
          </div>
        )}
      </header>

      {error && (
        <div className="mx-auto mt-24 max-w-sm text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-fg-2">
            <Icon name={/already played/i.test(error) ? "calendar" : "wifi"} size={22} />
          </div>
          <p className="mt-5 text-[17px] text-fg">{/already played/i.test(error) ? "You've played today's challenge." : "That didn't work."}</p>
          <p className="mt-1.5 text-sm text-fg-3">{/already played/i.test(error) ? "A new set of ten arrives at midnight UTC." : error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/" className="btn-ghost">
              Library
            </Link>
            {!/already played/i.test(error) && (
              <button className="btn-primary" onClick={() => void start()}>
                Try again
              </button>
            )}
            {/already played/i.test(error) && (
              <Link href="/leaderboard?board=daily" className="btn-primary">
                Today&apos;s leaderboard
              </Link>
            )}
          </div>
        </div>
      )}

      {!error && !view && !summary && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4" aria-busy>
          <div className="spinner" />
          <span className="text-sm text-fg-3">Picking questions you haven&apos;t seen</span>
        </div>
      )}

      {view && !summary && (
        <div className="flex flex-1 flex-col gap-6 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-fg-3">
            <span className="font-medium text-fg-2">{plainLabel(view.round.modeLabel)}</span>
            <span className="flex gap-[3px]" aria-label={`Difficulty ${view.round.difficulty} of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`h-2.5 w-[3px] rounded-full ${i < view.round.difficulty ? "bg-fg-2" : "bg-surface-4"}`} />
              ))}
            </span>
            {view.round.repeat && (
              <span className="flex items-center gap-1">
                <Icon name="refresh" size={13} />
                Seen {view.round.repeat.daysAgo} days ago
              </span>
            )}
            {view.modifier && (
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="chip bg-accent-soft font-medium text-accent">
                {view.modifier.label}
              </motion.span>
            )}
          </div>
          {view.notice && <div className="text-center text-sm text-warn-400">{view.notice}</div>}
          <AnimatePresence mode="wait">
            <motion.div
              key={view.round.roundId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col items-center gap-6 pb-6"
            >
              <RoundPlayer round={view.round} act={act} locked={!!reveal} reveal={reveal} resume={null} />
              {reveal && (
                <>
                  <RevealPanel reveal={reveal} points={result?.points} correct={result?.correct} breakdown={result?.breakdown} timedOut={result?.timedOut} />
                  <button autoFocus className="btn-primary btn-lg min-w-48" onClick={next} disabled={loadingNext}>
                    {loadingNext ? "Loading" : view.total && view.index + 1 >= view.total ? "See results" : "Next question"}
                    <Icon name="arrow-right" size={17} />
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          {!reveal && (
            <button onClick={quit} className="btn-quiet btn-sm mx-auto mt-auto sm:hidden">
              End game
            </button>
          )}
        </div>
      )}

      {summary && <Summary summary={summary} game={game} variant={variant} onAgain={variant === "daily" ? undefined : () => void start()} />}
    </div>
  );
}

const VARIANT_LABEL: Record<Variant, string> = { classic: "Classic", survival: "Survival", ranked: "Ranked", chaos: "Chaos", daily: "Daily" };
