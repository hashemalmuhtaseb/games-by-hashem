import type { PointsBreakdown, ScoringConfig } from "./types";

export const DEFAULT_SCORING: ScoringConfig = {
  base: 100,
  speedBonus: 50,
  difficultyMultiplier: [0.8, 1, 1.2, 1.4, 1.6],
  streakStep: 0.1,
  streakCap: 0.5,
  cluePenalty: 0.18,
  wrongAttemptPenalty: 0.25,
  minCorrectPoints: 10,
};

export function mergeScoring(...parts: (Partial<ScoringConfig> | undefined | null)[]): ScoringConfig {
  return Object.assign({}, DEFAULT_SCORING, ...parts.filter(Boolean));
}

export interface PointsInput {
  correct: boolean;
  /** 0..1 – how good the answer was (closeness, fraction of groups, clue factor…). */
  quality?: number;
  elapsedMs: number;
  timeLimitMs: number;
  difficulty: number;
  streak: number;
  /** Speed bonus is skipped for games where speed is meaningless (e.g. rarity). */
  speed?: boolean;
  /** Fixed points that bypass quality (e.g. rarity points already computed). */
  rarityPoints?: number;
}

export function computePoints(cfg: ScoringConfig, p: PointsInput): PointsBreakdown {
  if (!p.correct && !(p.quality && p.quality > 0)) {
    return { base: 0, speed: 0, difficulty: 0, streak: 0, total: 0 };
  }
  const quality = clamp(p.quality ?? 1, 0, 1);
  const base = p.rarityPoints ?? cfg.base * quality;
  const speedFactor = p.speed === false ? 0 : clamp(1 - p.elapsedMs / Math.max(1, p.timeLimitMs), 0, 1);
  const speed = cfg.speedBonus * speedFactor * quality;
  const dm = cfg.difficultyMultiplier[clamp(Math.round(p.difficulty), 1, cfg.difficultyMultiplier.length) - 1] ?? 1;
  const raw = base + speed;
  const difficulty = raw * (dm - 1);
  const streakMult = p.correct ? Math.min(p.streak * cfg.streakStep, cfg.streakCap) : 0;
  const streak = (raw + difficulty) * streakMult;
  let total = Math.round(raw + difficulty + streak);
  if (p.correct) total = Math.max(total, cfg.minCorrectPoints);
  return {
    base: Math.round(base),
    speed: Math.round(speed),
    difficulty: Math.round(difficulty),
    streak: Math.round(streak),
    rarity: p.rarityPoints,
    total,
  };
}

/** Quality for numeric estimates. Linear: within tolerance → full, falls to 0 at 4× tolerance. Log: ratio based. */
export function closeness(guess: number, actual: number, scale: "linear" | "log", tolerance: number): number {
  if (!Number.isFinite(guess)) return 0;
  if (scale === "linear") {
    const err = Math.abs(guess - actual);
    if (err <= tolerance * 0.25) return 1;
    return clamp(1 - err / (tolerance * 4), 0, 1);
  }
  if (guess <= 0 || actual <= 0) return 0;
  const ratio = Math.abs(Math.log10(guess / actual));
  // tolerance is in orders of magnitude, e.g. 0.05 ≈ ±12%
  if (ratio <= tolerance) return 1;
  return clamp(1 - (ratio - tolerance) / 1, 0, 1);
}

/** Quality factor when progressive clues were used: first clue = 1, then decays. */
export function clueQuality(cluesUsed: number, totalClues: number, penalty: number): number {
  const extra = Math.max(0, cluesUsed - 1);
  const maxExtra = Math.max(1, totalClues - 1);
  return clamp(1 - extra * penalty * (5 / Math.max(5, maxExtra + 1)), 0.15, 1);
}

/** Dense ranking with ties: equal points share a rank; tie broken by total response time when provided. */
export function rankPlayers<T extends { points: number; timeMs?: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = rows.slice().sort((a, b) => b.points - a.points || (a.timeMs ?? 0) - (b.timeMs ?? 0));
  let rank = 0;
  let prev: T | null = null;
  return sorted.map((r, i) => {
    if (!prev || prev.points !== r.points || (prev.timeMs ?? 0) !== (r.timeMs ?? 0)) rank = i + 1;
    prev = r;
    return { ...r, rank };
  });
}

/** XP needed to reach `level` (level 1 = 0 xp). */
export function xpForLevel(level: number): number {
  return Math.round(150 * (level - 1) ** 1.6);
}

export function levelForXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}
