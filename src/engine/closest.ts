/**
 * "Closest answer wins" maths for every numeric round.
 *
 * distance = |guess − correct|, compared after rounding to DISTANCE_DECIMALS so float noise
 * (0.1 + 0.2) can never split a genuine tie. The smallest distance wins; equal distances tie and
 * share the win. A guess above and a guess below the answer by the same amount are equally close.
 */

export const DISTANCE_DECIMALS = 6;

/** Human formatting for guesses: years (1000–2999, no unit) without a thousands separator. */
export function formatNumber(n: number, unit?: string): string {
  if (!unit && Number.isInteger(n) && n >= 1000 && n <= 2999) return String(n);
  return n.toLocaleString("en", { maximumFractionDigits: 6 });
}

export function roundTo(x: number, decimals = DISTANCE_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

export function distanceOf(guess: number, correct: number): number {
  return roundTo(Math.abs(guess - correct));
}

/**
 * Parses a typed guess. Accepts numbers, or strings like "1,998", " -3.5 ", "2 000".
 * Returns null for anything that is not a finite number.
 */
export function parseGuess(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/[\s,_]/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface ClosestEntry {
  playerId: string;
  guess: number | null;
}

export interface ClosestResult {
  playerId: string;
  guess: number | null;
  distance: number | null;
  /** 1 = closest. Players with equal distance share a rank. No guess → no rank. */
  rank: number | null;
  closest: boolean;
}

/** Ranks guesses by distance. Everyone at the smallest distance is a (possibly tied) winner. */
export function rankClosest(correct: number, entries: ClosestEntry[]): ClosestResult[] {
  const withD = entries.map((e) => ({ ...e, distance: e.guess === null || !Number.isFinite(e.guess) ? null : distanceOf(e.guess, correct) }));
  const valid = withD.filter((e) => e.distance !== null).sort((a, b) => a.distance! - b.distance!);
  const rankOf = new Map<string, number>();
  valid.forEach((e, i) => {
    const prev = valid[i - 1];
    rankOf.set(e.playerId, prev && prev.distance === e.distance ? rankOf.get(prev.playerId)! : i + 1);
  });
  const best = valid[0]?.distance ?? null;
  return withD.map((e) => ({
    playerId: e.playerId,
    guess: e.guess,
    distance: e.distance,
    rank: rankOf.get(e.playerId) ?? null,
    closest: best !== null && e.distance === best,
  }));
}

/** Points added on top of closeness points for the closest player(s) in a multiplayer round. */
export const CLOSEST_BONUS = 50;

interface GuessState {
  done: boolean;
  correct: boolean;
  points: number;
  breakdown?: { total: number; closest?: number };
  data: Record<string, unknown>;
}

/**
 * Multiplayer settlement for a numeric round: ranks every player's guess and gives the closest
 * player(s) the round win (+CLOSEST_BONUS, marked correct). Tied distances all win. Applied once,
 * on the server, after every player has finished or timed out. Points already reflect closeness,
 * which never increases with distance, so a farther guess can never beat a closer one.
 */
export function applyClosest(correct: number, states: Map<string, GuessState>): Map<string, ClosestResult> {
  const entries = [...states.entries()].map(([playerId, st]) => ({ playerId, guess: typeof st.data.guess === "number" ? st.data.guess : null }));
  const ranked = rankClosest(correct, entries);
  const contested = entries.length >= 2;
  for (const r of ranked) {
    const st = states.get(r.playerId)!;
    st.data.distance = r.distance;
    st.data.closest = r.closest;
    if (contested && r.closest) {
      st.correct = true;
      st.points += CLOSEST_BONUS;
      if (st.breakdown) {
        st.breakdown.closest = CLOSEST_BONUS;
        st.breakdown.total = st.points;
      }
    }
  }
  return new Map(ranked.map((r) => [r.playerId, r]));
}
