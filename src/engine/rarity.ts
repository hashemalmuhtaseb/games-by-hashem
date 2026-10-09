import type { Category } from "@/content/categories";
import type { WordEntry } from "@/content/datasets/wordlists";
import { compact } from "./normalize";

/**
 * Rarity model for Rare Words / Category Battle.
 *
 * 1. Baseline prior (documented): each category's answers are grouped into tiers.
 *    Probability mass per tier: T1 60%, T2 30%, T3 9%, T4 1%.
 *    Within T1 and T2 mass follows a gentle Zipf curve over the curated order (most typical first);
 *    within T3/T4 it is uniform.
 * 2. Observed data: every DISTINCT player counts once per (category, answer). Repeat submissions by
 *    the same player never move the numbers, so rarity can't be farmed.
 * 3. Smoothing: posterior p = (count + α·prior) / (total + α) with α = 200 pseudo-answers, so a
 *    handful of early votes can't swing scores wildly; observed data dominates once it is plentiful.
 * 4. Points: map -log10(p) from [0.8, 3.8] onto [10, 100].
 */

export const TIER_MASS = { 1: 0.6, 2: 0.3, 3: 0.09, 4: 0.01 } as const;
export const PRIOR_STRENGTH = 200;

const priorCache = new Map<string, Map<string, number>>();

export function answerKey(entry: WordEntry): string {
  return compact(entry.name);
}

export function priors(cat: Category): Map<string, number> {
  const cached = priorCache.get(cat.id);
  if (cached) return cached;
  const byTier: Record<number, WordEntry[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const e of cat.entries) byTier[e.tier].push(e);
  const present = [1, 2, 3, 4].filter((t) => byTier[t].length > 0);
  const totalMass = present.reduce((s, t) => s + TIER_MASS[t as 1 | 2 | 3 | 4], 0);
  const out = new Map<string, number>();
  for (const t of present) {
    const list = byTier[t];
    const mass = TIER_MASS[t as 1 | 2 | 3 | 4] / totalMass;
    const zipf = t <= 2;
    const weights = list.map((_, i) => (zipf ? 1 / Math.pow(i + 1, t === 1 ? 0.8 : 0.6) : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    list.forEach((e, i) => out.set(answerKey(e), (mass * weights[i]) / sum));
  }
  priorCache.set(cat.id, out);
  return out;
}

export interface RarityStats {
  counts: Map<string, number>;
  total: number;
}

export function posterior(prior: number, count: number, total: number): number {
  return (count + PRIOR_STRENGTH * prior) / (total + PRIOR_STRENGTH);
}

export function pointsFromProbability(p: number): number {
  const x = -Math.log10(Math.max(p, 1e-9));
  const t = (x - 0.8) / 3;
  return Math.round(10 + 90 * Math.max(0, Math.min(1, t)));
}

export function rarityFor(cat: Category, entry: WordEntry, stats: RarityStats): { probability: number; points: number; count: number } {
  const key = answerKey(entry);
  const prior = priors(cat).get(key) ?? 1 / Math.max(1, cat.entries.length);
  const count = stats.counts.get(key) ?? 0;
  const p = posterior(prior, count, stats.total);
  return { probability: p, points: pointsFromProbability(p), count };
}

/** Storage abstraction so tests can use memory and the app uses Postgres. */
export interface RarityStore {
  stats(categoryId: string): Promise<RarityStats>;
  /** Records a vote. Returns false when this player already voted for that answer (no change). */
  record(categoryId: string, entry: WordEntry, playerId: string): Promise<boolean>;
}

export class MemoryRarityStore implements RarityStore {
  private votes = new Set<string>();
  private data = new Map<string, RarityStats>();
  async stats(categoryId: string): Promise<RarityStats> {
    let s = this.data.get(categoryId);
    if (!s) {
      s = { counts: new Map(), total: 0 };
      this.data.set(categoryId, s);
    }
    return s;
  }
  async record(categoryId: string, entry: WordEntry, playerId: string): Promise<boolean> {
    const key = answerKey(entry);
    const v = `${categoryId}|${key}|${playerId}`;
    if (this.votes.has(v)) return false;
    this.votes.add(v);
    const s = await this.stats(categoryId);
    s.counts.set(key, (s.counts.get(key) ?? 0) + 1);
    s.total++;
    return true;
  }
}

/** Hive Mind: the inverse of rarity — the more people give an answer, the more it scores. */
export function commonPointsFromProbability(p: number): number {
  const x = Math.max(0, Math.min(1, (Math.log10(Math.max(p, 1e-6)) + 3.8) / 3.0));
  return Math.round(10 + 90 * x);
}
