import { compact, levenshtein, normalize, typoAllowance } from "./normalize";

/**
 * Answer recognition for open categories (footballers, cities, animals…).
 *
 * The dataset is the source of truth: an answer is accepted only when it resolves to a verified
 * entry. Resolution tries, in order:
 *   1. exact name or alias (accents, case, punctuation, "the"/"a" and spacing ignored);
 *   2. reordered names ("Rojo, Marcos", "Rojo Marcos") for people;
 *   3. surname only ("Salah") for people, when one player clearly owns that surname;
 *   4. plural/singular ("lions" → "lion") for things;
 *   5. typo tolerance — accepted automatically only when a single entry is clearly meant
 *      (one edit, or two on long names); otherwise the player is asked "Did you mean…?".
 * Different people are never merged: two entries only resolve together when their names are
 * identical, and close-but-different names produce a suggestion instead of a guess.
 */

export interface NamedEntry {
  name: string;
  aliases: string[];
  /** Fame signal (e.g. Wikipedia sitelinks). Higher = better known. */
  fame?: number;
}

export type Resolution<T> =
  | { status: "exact"; entry: T; via: "name" | "alias" | "reordered" | "surname" | "plural" }
  | { status: "corrected"; entry: T; distance: number }
  | { status: "suggest"; suggestions: T[]; reason: string }
  | { status: "none"; reason: string };

interface Opts {
  person: boolean;
  /** What the category calls an entry, for messages ("footballer"). */
  noun: string;
}

const MIN_SURNAME_LEN = 4;
/** A surname resolves to the best-known player only if they're this much better known than the next. */
const SURNAME_DOMINANCE = 3;

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function sortedKey(s: string): string {
  return tokens(s).sort().join("");
}

/** "Rojo, Marcos" → "Marcos Rojo". */
function unComma(s: string): string | null {
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : null;
}

function singular(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith("ies") && word.length > 4) out.push(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 4) out.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) out.push(word.slice(0, -1));
  return out;
}

export class NameIndex<T extends NamedEntry> {
  private exact = new Map<string, T[]>();
  private aliasKeys = new Set<string>();
  private reordered = new Map<string, T[]>();
  private surnames = new Map<string, T[]>();
  /** Fuzzy buckets: first character → [key, entry]. */
  private buckets = new Map<string, { key: string; entry: T }[]>();

  constructor(
    readonly entries: readonly T[],
    private opts: Opts,
  ) {
    for (const e of entries) {
      const nameKey = compact(e.name);
      this.add(this.exact, nameKey, e);
      for (const a of e.aliases) {
        const k = compact(a);
        if (!k) continue;
        if (k !== nameKey) this.aliasKeys.add(k);
        this.add(this.exact, k, e);
      }
      if (opts.person) {
        const toks = tokens(e.name);
        if (toks.length >= 2) {
          this.add(this.reordered, sortedKey(e.name), e);
          const last = toks[toks.length - 1];
          if (last.length >= MIN_SURNAME_LEN) this.add(this.surnames, last, e);
        }
      }
      for (const k of new Set([nameKey, ...e.aliases.map(compact)])) {
        if (k.length < 5) continue;
        const b = this.buckets.get(k[0]) ?? [];
        b.push({ key: k, entry: e });
        this.buckets.set(k[0], b);
      }
    }
  }

  private add(m: Map<string, T[]>, k: string, e: T) {
    if (!k) return;
    const l = m.get(k);
    if (!l) m.set(k, [e]);
    else if (!l.includes(e)) l.push(e);
  }

  private famous(list: T[]): T {
    return list.reduce((a, b) => ((b.fame ?? 0) > (a.fame ?? 0) ? b : a));
  }

  private byFame(list: T[]): T[] {
    return [...new Set(list)].sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0));
  }

  /** Distinct by displayed name: two entries with the same name are the same answer to a player. */
  private distinctNames(list: T[]): T[] {
    const seen = new Map<string, T>();
    for (const e of this.byFame(list)) if (!seen.has(compact(e.name))) seen.set(compact(e.name), e);
    return [...seen.values()];
  }

  resolve(input: string, filter?: (e: T) => boolean): Resolution<T> {
    const ok = (e: T) => !filter || filter(e);
    const raw = input.trim();
    const variants = [raw, unComma(raw)].filter((x): x is string => !!x);
    const noun = this.opts.noun;
    let filteredOut: T | null = null;
    const aliasHits: T[] = [];
    // 1–2. exact name / alias / reordered
    for (const v of variants) {
      const k = compact(v);
      if (!k) continue;
      const hits = this.exact.get(k);
      if (hits) {
        const good = hits.filter(ok);
        // Someone whose actual name this is beats someone who merely has it as a nickname.
        const named = good.filter((g) => compact(g.name) === k);
        if (named.length) return { status: "exact", entry: this.famous(named), via: "name" };
        // A single word that is only someone's nickname ("Smith") is checked against surnames first.
        const oneWord = this.opts.person && tokens(v).length === 1;
        if (good.length && !(oneWord && (this.surnames.get(tokens(v)[0])?.length ?? 0) > 0)) return { status: "exact", entry: this.famous(good), via: "alias" };
        if (good.length) aliasHits.push(...good);
        filteredOut ??= this.famous(hits);
      }
      if (this.opts.person) {
        const r = this.reordered.get(sortedKey(v));
        if (r) {
          const good = r.filter(ok);
          if (good.length) return { status: "exact", entry: this.famous(good), via: "reordered" };
          filteredOut ??= this.famous(r);
        }
      }
    }
    // 3. surname only
    const toks = tokens(variants[0]);
    if (this.opts.person && toks.length === 1 && toks[0].length >= MIN_SURNAME_LEN) {
      const all = [...(this.surnames.get(toks[0]) ?? []), ...aliasHits];
      const cands = this.distinctNames(all.filter(ok));
      if (cands.length === 1) return { status: "exact", entry: cands[0], via: "surname" };
      if (cands.length > 1) {
        const [a, b] = cands;
        if ((a.fame ?? 0) >= SURNAME_DOMINANCE * Math.max(1, b.fame ?? 0)) return { status: "exact", entry: a, via: "surname" };
        return { status: "suggest", suggestions: cands.slice(0, 4), reason: `Several ${noun}s are called ${input.trim()}. Which one did you mean?` };
      }
      if (all.length) filteredOut ??= this.famous(all);
    }
    // 4. plurals (things only)
    if (!this.opts.person && toks.length >= 1) {
      const last = toks[toks.length - 1];
      for (const s of singular(last)) {
        const k = compact([...toks.slice(0, -1), s].join(" "));
        const hits = this.exact.get(k)?.filter(ok);
        if (hits?.length) return { status: "exact", entry: this.famous(hits), via: "plural" };
      }
    }
    // 5. typos
    const fuzzy = this.fuzzy(variants, ok);
    if (fuzzy) return fuzzy;
    if (filteredOut) return { status: "none", reason: `${filteredOut.name} doesn't fit this round's rule.` };
    return { status: "none", reason: `We couldn't find a ${noun} called “${raw}” in our verified list.` };
  }

  private fuzzy(variants: string[], ok: (e: T) => boolean): Resolution<T> | null {
    const found = new Map<T, number>();
    for (const v of variants) {
      const n = compact(v);
      const allow = typoAllowance(n.length);
      if (allow === 0) continue;
      const scan = (list: { key: string; entry: T }[] | undefined) => {
        for (const { key, entry } of list ?? []) {
          if (Math.abs(key.length - n.length) > allow || !ok(entry)) continue;
          const d = levenshtein(n, key, allow);
          if (d <= allow && d < (found.get(entry) ?? Infinity)) found.set(entry, d);
        }
      };
      scan(this.buckets.get(n[0]));
      // People: a typo in the first letter of the first name ("Narcos Rojo") still finds the
      // player through an exact surname.
      if (this.opts.person) {
        const toks = tokens(v);
        if (toks.length >= 2) {
          const last = toks[toks.length - 1];
          for (const e of this.surnames.get(last) ?? []) {
            if (!ok(e) || found.has(e)) continue;
            const d = levenshtein(n, compact(e.name), allow);
            if (d <= allow) found.set(e, d);
          }
        }
      }
    }
    if (!found.size) return null;
    const best = Math.min(...found.values());
    const atBest = this.distinctNames([...found.entries()].filter(([, d]) => d === best).map(([e]) => e));
    const len = compact(variants[0]).length;
    const autoLimit = len >= 12 ? 2 : 1;
    if (atBest.length === 1 && best <= autoLimit) return { status: "corrected", entry: atBest[0], distance: best };
    const ranked = this.distinctNames([...found.keys()]).sort((a, b) => found.get(a)! - found.get(b)! || (b.fame ?? 0) - (a.fame ?? 0));
    return { status: "suggest", suggestions: ranked.slice(0, 4), reason: "Close, but not an exact match. Did you mean one of these?" };
  }
}
