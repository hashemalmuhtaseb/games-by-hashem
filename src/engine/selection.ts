import { weightedSample, type Rng } from "./rng";
import type { Candidate, GameDefinition, ModeDefinition } from "./types";

/**
 * Anti-repetition selection engine.
 *
 * Every possible question for a game is enumerated as a cheap Candidate. Each pick weighs ALL
 * candidates against:
 *  - content history: exact question seen before (strong, slowly-decaying penalty)
 *  - subject history: same movie/player/country asked a different way (near-duplicate penalty)
 *  - session state: nothing repeats within a session, and no subject appears twice
 *  - difficulty fit: Gaussian around the player's adaptive target difficulty
 *  - topic & mode diversity: recently used topics/modes are down-weighted
 *  - freshness: newly published content gets a boost
 *  - moderation: retired or heavily reported content is excluded
 * The pick is a weighted random draw, so two players with identical histories still diverge.
 */

export interface HistoryView {
  contentLastSeen: Map<string, number>;
  subjectLastSeen: Map<string, number>;
}

export interface SessionMemory {
  keys: Set<string>;
  subjects: Set<string>;
  topics: string[]; // most recent last
  modes: string[];
}

export interface SelectOptions {
  candidates: Candidate[];
  history: HistoryView;
  session: SessionMemory;
  targetDifficulty: number;
  rng: Rng;
  now: number;
  excluded?: Set<string>;
  /** Strict mode (daily challenge): ignore personal history entirely. */
  ignoreHistory?: boolean;
}

export interface Selection {
  candidate: Candidate;
  weight: number;
  repeat?: { daysAgo: number };
  freshRemaining: number;
}

const DAY = 86_400_000;

export function candidateWeight(c: Candidate, o: SelectOptions): number {
  if (o.excluded?.has(c.key)) return 0;
  if (o.session.keys.has(c.key) || o.session.subjects.has(c.subject)) return 0;
  let w = 1;
  if (!o.ignoreHistory) {
    const seen = o.history.contentLastSeen.get(c.key);
    if (seen !== undefined) {
      const d = (o.now - seen) / DAY;
      w *= 0.01 + 0.99 * (1 - Math.exp(-d / 45));
    } else {
      const subj = o.history.subjectLastSeen.get(c.subject);
      if (subj !== undefined) {
        const d = (o.now - subj) / DAY;
        w *= 0.25 + 0.75 * (1 - Math.exp(-d / 7));
      }
    }
  }
  const dd = c.difficulty - o.targetDifficulty;
  w *= Math.exp(-(dd * dd) / (2 * 1.1 * 1.1));
  const recentTopics = o.session.topics.slice(-4);
  const topicHits = recentTopics.filter((t) => t === c.topic).length;
  w *= Math.pow(0.35, topicHits);
  const modeHits = o.session.modes.slice(-3).filter((m) => m === c.mode).length;
  w *= Math.pow(0.6, modeHits);
  if (c.isNew) w *= 1.5;
  return w;
}

export function selectCandidate(o: SelectOptions): Selection | null {
  if (!o.candidates.length) return null;
  const weights = o.candidates.map((c) => candidateWeight(c, o));
  const freshRemaining = o.candidates.reduce(
    (n, c, i) => n + (weights[i] > 0 && !o.history.contentLastSeen.has(c.key) ? 1 : 0),
    0,
  );
  const [picked] = weightedSample(o.rng, o.candidates, weights, 1);
  if (!picked) return null;
  const seen = o.ignoreHistory ? undefined : o.history.contentLastSeen.get(picked.key);
  return {
    candidate: picked,
    weight: weights[o.candidates.indexOf(picked)],
    repeat: seen !== undefined ? { daysAgo: Math.floor((o.now - seen) / DAY) } : undefined,
    freshRemaining,
  };
}

/** Candidate cache: modes enumerate deterministically, so we compute each list once per process. */
const cache = new Map<string, Candidate[]>();

export function modeCandidates(game: GameDefinition, mode: ModeDefinition): Candidate[] {
  const k = `${game.slug}/${mode.id}`;
  let list = cache.get(k);
  if (!list) {
    list = mode.unavailableReason?.() ? [] : mode.candidates();
    cache.set(k, list);
  }
  return list;
}

/** Drops cached candidate lists for modes whose content changes at runtime (e.g. "community"). */
export function invalidateModeCandidates(modeId: string) {
  for (const k of cache.keys()) if (k.endsWith(`/${modeId}`)) cache.delete(k);
}

export function gameCandidates(game: GameDefinition, modeIds?: string[]): Candidate[] {
  const out: Candidate[] = [];
  for (const m of game.modes) {
    if (modeIds && modeIds.length && !modeIds.includes(m.id)) continue;
    out.push(...modeCandidates(game, m));
  }
  return out;
}

/** Adaptive difficulty: target rises with skill (rolling accuracy) and round number. */
export function targetDifficulty(skill: number, roundIndex: number, totalRounds: number): number {
  const base = 1.2 + skill * 2.6; // skill 0 → 1.2, skill 1 → 3.8
  const ramp = totalRounds > 1 ? (roundIndex / (totalRounds - 1)) * 1.0 : 0;
  return Math.max(1, Math.min(5, base + ramp - 0.3));
}

export function rememberInSession(s: SessionMemory, c: Candidate): void {
  s.keys.add(c.key);
  s.subjects.add(c.subject);
  s.topics.push(c.topic);
  s.modes.push(c.mode);
}

export function emptySessionMemory(): SessionMemory {
  return { keys: new Set(), subjects: new Set(), topics: [], modes: [] };
}
