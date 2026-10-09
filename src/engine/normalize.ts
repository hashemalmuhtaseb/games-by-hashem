/** Answer normalization and tolerant matching (typos, accents, aliases, articles). */

export function normalize(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compact form ignores spaces too ("Real Madrid" == "realmadrid"). */
export function compact(input: string): string {
  return normalize(input).replace(/ /g, "");
}

export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/** How many typos we forgive for an answer of a given length. Short answers must be exact. */
export function typoAllowance(len: number): number {
  if (len < 5) return 0;
  if (len < 9) return 1;
  return 2;
}

export interface MatchCandidate<T> {
  value: T;
  names: string[];
}

export interface MatchResult<T> {
  value: T;
  exact: boolean;
  distance: number;
}

/**
 * Find which candidate an input refers to. Exact (normalized/compact) matches win.
 * A fuzzy match is only accepted when it is unambiguous: no other candidate is equally close,
 * so "Iran" never silently becomes "Iraq".
 */
export function findMatch<T>(input: string, candidates: readonly MatchCandidate<T>[]): MatchResult<T> | null {
  const n = compact(input);
  if (!n) return null;
  for (const c of candidates) {
    for (const name of c.names) if (compact(name) === n) return { value: c.value, exact: true, distance: 0 };
  }
  const allow = typoAllowance(n.length);
  if (allow === 0) return null;
  let best: MatchResult<T> | null = null;
  let tie = false;
  for (const c of candidates) {
    let d = Infinity;
    for (const name of c.names) {
      const cn = compact(name);
      if (typoAllowance(cn.length) === 0) continue;
      d = Math.min(d, levenshtein(n, cn, allow));
    }
    if (d > allow) continue;
    if (!best || d < best.distance) {
      best = { value: c.value, exact: false, distance: d };
      tie = false;
    } else if (d === best.distance && best.value !== c.value) {
      tie = true;
    }
  }
  return best && !tie ? best : null;
}

export function matchesAny(input: string, accepted: readonly string[]): boolean {
  return findMatch(input, [{ value: true, names: [...accepted] }]) !== null;
}

/** Character trigram set, used for near-duplicate detection of question text. */
export function trigrams(s: string): Set<string> {
  const t = ` ${normalize(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function textSimilarity(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b));
}

/** Order-insensitive fingerprint: normalized, stop-words removed, words sorted. */
export function fingerprint(s: string): string {
  const stop = new Set(["the", "a", "an", "of", "in", "is", "which", "what", "who", "this", "to", "and", "for", "on"]);
  return normalize(s)
    .split(" ")
    .filter((w) => w && !stop.has(w))
    .sort()
    .join(" ");
}
