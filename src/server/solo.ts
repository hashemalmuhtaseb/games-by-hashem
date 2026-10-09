import { randomBytes } from "node:crypto";
import { singleton } from "@/lib/globals";
import { db } from "@/lib/db";
import { getGame, triviaRouletteGame } from "@/engine/registry";
import { createRng, randomSeed, type Rng } from "@/engine/rng";
import { emptySessionMemory, type HistoryView, type SessionMemory } from "@/engine/selection";
import { pickRound, type PickState } from "./picker";
import { applyAction, applyTimeout, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import type { Action, GameDefinition, PlayerRoundState, PublicRound, RevealPayload, Round } from "@/engine/types";
import { loadHistory, recordSeen } from "./history";
import { prismaRarityStore } from "./rarity-store";
import { buildReveal } from "./reveal";
import { applyGameResult, getSkill, trackEvent, updateRating, type ProgressResult } from "./progress";
import { gameConfig } from "./game-config";

export type Variant = "classic" | "survival" | "ranked" | "daily" | "chaos";

export const MODIFIERS = [
  { id: "double", label: "Double points!", icon: "✖️2" },
  { id: "quick", label: "Half time!", icon: "⏱️" },
  { id: "blind", label: "Mystery round — no category shown", icon: "🙈" },
  { id: "jackpot", label: "Jackpot: ×3 if right, −50 if wrong", icon: "🎰" },
] as const;
type ModifierId = (typeof MODIFIERS)[number]["id"];

interface CurrentRound {
  roundId: string;
  round: Round;
  pub: PublicRound;
  state: PlayerRoundState;
  deadline: number;
  dbRoundId?: string;
  modifier?: ModifierId;
  reveal?: RevealPayload;
}

export interface SoloSession {
  id: string;
  playerId: string;
  gameSlug: string;
  modes?: string[];
  variant: Variant;
  rng: Rng;
  seed: string;
  total: number; // 0 = endless (survival)
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  lives: number | null;
  maxRarity: number;
  qualities: number[];
  memory: SessionMemory;
  history: HistoryView;
  skill: number;
  current: CurrentRound | null;
  log: { contentKey: string; points: number; correct: boolean }[];
  matchId?: string;
  finished: boolean;
  result?: SessionSummary;
  createdAt: number;
  lastActive: number;
  notice?: string;
}

export interface SessionSummary {
  score: number;
  correct: number;
  rounds: number;
  bestStreak: number;
  progress: ProgressResult | null;
  rating?: { rating: number; delta: number };
  dailyRank?: number;
}

const sessions = singleton("soloSessions", () => new Map<string, SoloSession>());
const GRACE_MS = 1500;

function sweep() {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.lastActive > 3 * 3600_000) sessions.delete(k);
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function startSession(opts: { playerId: string; gameSlug: string; modes?: string[]; variant: Variant }): Promise<SoloSession> {
  sweep();
  const isDaily = opts.variant === "daily";
  const game = isDaily ? triviaRouletteGame : getGame(opts.gameSlug);
  if (!game) throw new Error("unknown game");
  const cfg = await gameConfig(game.slug);
  if (!cfg.enabled) throw new Error("This game is temporarily unavailable.");
  const seed = isDaily ? `daily:${todayKey()}` : randomSeed();
  const [history, skill] = await Promise.all([isDaily ? Promise.resolve({ contentLastSeen: new Map(), subjectLastSeen: new Map() }) : loadHistory([opts.playerId]), getSkill([opts.playerId], game.slug)]);
  const s: SoloSession = {
    id: randomBytes(16).toString("base64url"),
    playerId: opts.playerId,
    gameSlug: game.slug,
    modes: opts.modes?.length ? opts.modes : undefined,
    variant: opts.variant,
    seed,
    rng: createRng(seed),
    total: opts.variant === "survival" ? 0 : isDaily ? 10 : opts.variant === "ranked" ? 10 : game.rounds,
    index: -1,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    lives: opts.variant === "survival" ? 3 : null,
    maxRarity: 0,
    qualities: [],
    memory: emptySessionMemory(),
    history,
    skill: isDaily ? 0.5 : skill,
    current: null,
    log: [],
    finished: false,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  if (isDaily) {
    const done = await db.dailyResult.findUnique({ where: { date_playerId: { date: todayKey(), playerId: opts.playerId } } });
    if (done) throw new Error("You've already played today's Daily Challenge — come back tomorrow!");
  }
  sessions.set(s.id, s);
  const match = await db.match.create({ data: { mode: `solo:${s.variant}`, gameSlug: s.gameSlug, seed } });
  s.matchId = match.id;
  await trackEvent("game_start", s.playerId, s.gameSlug, { variant: s.variant });
  return s;
}

export function getSession(id: string, playerId: string): SoloSession | null {
  const s = sessions.get(id);
  if (!s || s.playerId !== playerId) return null;
  s.lastActive = Date.now();
  return s;
}

async function buildNextRound(s: SoloSession, game: GameDefinition) {
  const st = {
    modes: s.modes, history: s.history, memory: s.memory, rng: s.rng, skill: s.skill, index: s.index + 1, total: s.total,
    difficultyBoost: s.variant === "survival" ? Math.min(1.5, (s.index + 1) * 0.1) : 0,
    ignoreHistory: s.variant === "daily",
    timeLimitSec: s.gameSlug === "quickfire" ? Math.max(8, 16 - Math.floor((s.index + 1) / 3) * 2) : undefined,
  } as PickState;
  const out = await pickRound(st, game);
  s.modes = st.modes;
  if (st.notice) s.notice = st.notice;
  return out;
}

export interface RoundView {
  round: PublicRound;
  index: number;
  total: number;
  score: number;
  streak: number;
  lives: number | null;
  deadline: number;
  serverNow: number;
  modifier?: (typeof MODIFIERS)[number];
  notice?: string;
}

export async function nextRound(s: SoloSession): Promise<RoundView | { finished: true; summary: SessionSummary }> {
  if (s.current && !s.current.state.done) return viewOf(s);
  if (s.finished) return { finished: true, summary: s.result! };
  const over = (s.total > 0 && s.index + 1 >= s.total) || (s.lives !== null && s.lives <= 0) || s.index >= 49;
  if (over) return { finished: true, summary: await finishSession(s) };
  const game = s.variant === "daily" ? triviaRouletteGame : getGame(s.gameSlug)!;
  const built = await buildNextRound(s, game);
  if (!built) return { finished: true, summary: await finishSession(s) };
  s.index++;
  const now = Date.now();
  let modifier: ModifierId | undefined;
  if (s.variant === "chaos" && s.rng() < 0.55) modifier = MODIFIERS[Math.floor(s.rng() * MODIFIERS.length)].id;
  if (modifier === "quick") built.round.pub.timeLimitSec = Math.max(6, Math.round(built.round.pub.timeLimitSec / 2));
  const roundId = randomBytes(9).toString("base64url");
  const pub: PublicRound = { ...built.round.pub, roundId, repeat: built.repeat };
  if (modifier === "blind") pub.modeLabel = "🙈 Mystery round";
  const state = newPlayerState(built.round, now);
  s.current = { roundId, round: built.round, pub, state, deadline: now + pub.timeLimitSec * 1000 + GRACE_MS, modifier };
  // Persist: the question counts as "seen" the moment it is shown, even if skipped.
  const dbRound = await db.round.create({ data: { matchId: s.matchId!, index: s.index, gameSlug: built.round.gameSlug, contentKey: built.round.contentKey } });
  s.current.dbRoundId = dbRound.id;
  {
    await recordSeen([{ playerId: s.playerId, gameSlug: built.round.gameSlug, contentKey: built.round.contentKey, subjectKey: built.round.subjectKey, topic: built.round.topic }]);
  }
  s.history.contentLastSeen.set(built.round.contentKey, now);
  s.history.subjectLastSeen.set(built.round.subjectKey, now);
  return viewOf(s);
}

function viewOf(s: SoloSession): RoundView {
  const c = s.current!;
  const notice = s.notice;
  s.notice = undefined;
  return {
    round: c.pub,
    index: s.index,
    total: s.total,
    score: s.score,
    streak: s.streak,
    lives: s.lives,
    deadline: c.deadline,
    serverNow: Date.now(),
    modifier: c.modifier ? MODIFIERS.find((m) => m.id === c.modifier) : undefined,
    notice,
  };
}

export interface ActView {
  error?: string;
  feedback?: Record<string, unknown>;
  reveal?: Record<string, unknown>;
  done: boolean;
  correct?: boolean;
  points?: number;
  breakdown?: PlayerRoundState["breakdown"];
  answer?: RevealPayload;
  score: number;
  streak: number;
  lives: number | null;
  timedOut?: boolean;
}

export async function act(s: SoloSession, roundId: string, action: Action): Promise<ActView> {
  const c = s.current;
  if (!c || c.roundId !== roundId) return { error: "That round is no longer active.", done: true, score: s.score, streak: s.streak, lives: s.lives };
  if (c.state.done) return { error: "Already answered.", done: true, score: s.score, streak: s.streak, lives: s.lives, answer: c.reveal };
  const now = Date.now();
  const cfg = await gameConfig(s.gameSlug);
  const ctx = { now, streak: s.streak, playerId: s.playerId, scoring: mergeScoring(getGame(c.round.gameSlug)?.scoring, cfg.scoring), services: { rarity: prismaRarityStore } };
  let result: Awaited<ReturnType<typeof applyAction>> = {};
  let timedOut = false;
  if (now > c.deadline) {
    applyTimeout(c.round, c.state, ctx);
    timedOut = true;
  } else {
    result = await applyAction(c.round, c.state, action, ctx);
    if (result.error) return { error: result.error, done: false, score: s.score, streak: s.streak, lives: s.lives };
  }
  if (!c.state.done) return { feedback: result.feedback, reveal: result.reveal, done: false, score: s.score, streak: s.streak, lives: s.lives };
  return { ...(await settle(s, c)), feedback: result.feedback, reveal: result.reveal, timedOut };
}

/** Called by the client when its timer hits zero; the server double-checks the deadline. */
export async function timeout(s: SoloSession, roundId: string): Promise<ActView> {
  const c = s.current;
  if (!c || c.roundId !== roundId) return { error: "stale round", done: true, score: s.score, streak: s.streak, lives: s.lives };
  if (c.state.done) return { done: true, score: s.score, streak: s.streak, lives: s.lives, answer: c.reveal, points: c.state.points, correct: c.state.correct, breakdown: c.state.breakdown };
  if (Date.now() < c.deadline - GRACE_MS - 250) return { error: "time is not up yet", done: false, score: s.score, streak: s.streak, lives: s.lives };
  const cfg = await gameConfig(s.gameSlug);
  applyTimeout(c.round, c.state, { now: Date.now(), streak: s.streak, playerId: s.playerId, scoring: mergeScoring(getGame(c.round.gameSlug)?.scoring, cfg.scoring), services: { rarity: prismaRarityStore } });
  return { ...(await settle(s, c)), timedOut: true };
}

async function settle(s: SoloSession, c: CurrentRound): Promise<ActView> {
  const st = c.state;
  if (c.modifier === "double") st.points *= 2;
  if (c.modifier === "jackpot") st.points = st.correct ? st.points * 3 : -50;
  if (st.breakdown) st.breakdown.total = st.points;
  s.score = Math.max(0, s.score + st.points);
  if (st.correct) {
    s.streak++;
    s.correct++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.streak = 0;
    if (s.lives !== null) s.lives--;
  }
  s.qualities.push(st.quality);
  if (c.round.handler === "rare") s.maxRarity = Math.max(s.maxRarity, st.breakdown?.rarity ?? 0);
  s.log.push({ contentKey: c.round.contentKey, points: st.points, correct: st.correct });
  c.reveal = await buildReveal(c.round, { rarity: prismaRarityStore }, [{ answerKey: st.data.answerKey as string | undefined, label: st.answerLabel }]);
  if (c.dbRoundId) {
    await db.submission
      .create({ data: { roundId: c.dbRoundId, playerId: s.playerId, answer: { label: st.answerLabel ?? null, attempts: st.attempts.length } as object, correct: st.correct, points: st.points, responseMs: Math.max(0, Date.now() - st.startedAt) } })
      .catch(() => undefined);
  }
  await db.question.updateMany({ where: { contentKey: c.round.contentKey }, data: { playCount: { increment: 1 }, correctCount: st.correct ? { increment: 1 } : undefined, lastPlayedAt: new Date() } });
  return { done: true, correct: st.correct, points: st.points, breakdown: st.breakdown, answer: c.reveal, score: s.score, streak: s.streak, lives: s.lives };
}

async function finishSession(s: SoloSession): Promise<SessionSummary> {
  if (s.finished && s.result) return s.result;
  s.finished = true;
  const rounds = s.log.length;
  let progress: ProgressResult | null = null;
  let rating: SessionSummary["rating"];
  let dailyRank: number | undefined;
  if (s.matchId) {
    await db.match.update({ where: { id: s.matchId }, data: { endedAt: new Date() } });
    await db.score.create({ data: { matchId: s.matchId, playerId: s.playerId, points: s.score, rank: 1, correct: s.correct, rounds } }).catch(() => undefined);
  }
  if (rounds > 0) {
    progress = await applyGameResult({ playerId: s.playerId, gameSlug: s.variant === "daily" ? "daily" : s.gameSlug, points: s.score, rounds, correct: s.correct, bestStreak: s.bestStreak, variant: s.variant, maxRarity: s.maxRarity, survivedRounds: s.variant === "survival" ? rounds : 0, qualities: s.qualities });
    if (s.variant === "ranked") {
      const perf = s.qualities.reduce((a, b) => a + b, 0) / Math.max(1, s.qualities.length);
      rating = await updateRating(s.playerId, s.gameSlug, perf);
      await updateRating(s.playerId, "global", perf);
    }
    if (s.variant === "daily") {
      await db.dailyResult.create({ data: { date: todayKey(), playerId: s.playerId, points: s.score, correct: s.correct } }).catch(() => undefined);
      dailyRank = (await db.dailyResult.count({ where: { date: todayKey(), points: { gt: s.score } } })) + 1;
    }
  }
  await trackEvent("game_end", s.playerId, s.gameSlug, { variant: s.variant, score: s.score, rounds, durationMs: Date.now() - s.createdAt });
  s.result = { score: s.score, correct: s.correct, rounds, bestStreak: s.bestStreak, progress, rating, dailyRank };
  return s.result;
}

export async function quitSession(s: SoloSession): Promise<SessionSummary> {
  return finishSession(s);
}
