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

type Variant = "classic" | "survival" | "ranked" | "chaos" | "daily";
interface GameLite {
  slug: string;
  name: string;
  icon: string;
  accent: [string, string];
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
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4 pb-10">
      <header className="flex items-center gap-3 py-4">
        <Link href={game.slug === "roulette" && variant === "daily" ? "/" : `/games/${game.slug}`} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-white" aria-label="Back">
          ←
        </Link>
        <span className="text-2xl">{game.icon}</span>
        <div className="flex-1 leading-tight">
          <div className="display font-bold text-white">{game.name}</div>
          <div className="text-xs text-ink-400 capitalize">
            {variant === "daily" ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : variant}
            {view && ` · round ${view.index + 1}${view.total ? ` / ${view.total}` : ""}`}
          </div>
        </div>
        {lives !== null && (
          <div className="flex gap-0.5 text-lg" aria-label={`${lives} lives`}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < lives ? "" : "opacity-20 grayscale"}>
                ❤️
              </span>
            ))}
          </div>
        )}
        <AnimatePresence>
          {streak >= 2 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="chip border-orange-500/40 text-orange-400">
              🔥 {streak}
            </motion.span>
          )}
        </AnimatePresence>
        <motion.div key={score} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="display min-w-16 text-right text-2xl font-black text-white tabular-nums">
          {score.toLocaleString()}
          {view?.chips && <span className="ml-1 align-middle text-xs font-semibold tracking-wide text-ink-400 uppercase">chips</span>}
        </motion.div>
        {view && !summary && (
          <button onClick={quit} className="rounded-lg px-2 py-1 text-xs text-ink-400 hover:bg-white/5 hover:text-white">
            End
          </button>
        )}
      </header>

      {error && (
        <div className="card mx-auto mt-16 max-w-md p-8 text-center">
          <div className="text-4xl">😵</div>
          <p className="mt-3 text-ink-100">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/" className="btn-ghost">
              Home
            </Link>
            {!/already played/i.test(error) && (
              <button className="btn-primary" onClick={() => void start()}>
                Try again
              </button>
            )}
            {/already played/i.test(error) && (
              <Link href="/leaderboard?board=daily" className="btn-primary">
                See today&apos;s leaderboard
              </Link>
            )}
          </div>
        </div>
      )}

      {!error && !view && !summary && (
        <div className="grid flex-1 place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-brand-400" />
        </div>
      )}

      {view && !summary && (
        <div className="flex flex-1 flex-col gap-5">
          <TimerBar deadline={view.deadline} offset={offset} total={view.round.timeLimitSec} onZero={onTimeUp} stopped={!!reveal} />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="chip">{view.round.modeLabel}</span>
            <span className="chip">{"★".repeat(view.round.difficulty)}<span className="opacity-30">{"★".repeat(5 - view.round.difficulty)}</span></span>
            {view.round.repeat && <span className="chip border-warn-400/40 text-warn-400">↺ Seen {view.round.repeat.daysAgo} days ago</span>}
            {view.modifier && (
              <motion.span initial={{ scale: 0.5, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} className="chip border-hot-500/50 bg-hot-500/15 text-hot-500">
                {view.modifier.icon} {view.modifier.label}
              </motion.span>
            )}
          </div>
          {view.notice && <div className="text-center text-sm text-warn-400">{view.notice}</div>}
          <AnimatePresence mode="wait">
            <motion.div key={view.round.roundId} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col items-center gap-6">
              <RoundPlayer round={view.round} act={act} locked={!!reveal} reveal={reveal} resume={null} balance={view.chips ? score : undefined} />
              {reveal && (
                <>
                  <RevealPanel reveal={reveal} points={result?.points} correct={result?.correct} breakdown={result?.breakdown} timedOut={result?.timedOut} />
                  <button autoFocus className="btn-primary px-10 py-3 text-lg" onClick={next} disabled={loadingNext}>
                    {loadingNext ? "Loading…" : "Next →"}
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {summary && <Summary summary={summary} game={game} variant={variant} onAgain={variant === "daily" ? undefined : () => void start()} />}
    </div>
  );
}
