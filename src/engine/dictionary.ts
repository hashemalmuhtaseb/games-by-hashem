import { createRequire } from "node:module";
import { ANIMALS, FOODS, FRUITS_VEG, SPORTS, JOBS } from "@/content/datasets/wordlists";
import { normalize } from "./normalize";

/**
 * English dictionary for Word Chain validation.
 * Source: `an-array-of-english-words` (MIT, ~275k words, derived from public word lists).
 * Loaded lazily on the server only.
 */

let words: Set<string> | null = null;
let familiar: Map<string, string[]> | null = null;

function load(): Set<string> {
  if (!words) {
    const req = createRequire(import.meta.url);
    const list = req("an-array-of-english-words") as string[];
    words = new Set(list);
  }
  return words;
}

export function dictionaryWords(): Set<string> {
  return load();
}

export function isDictionaryWord(w: string): boolean {
  return /^[a-z]+$/.test(w) && load().has(w);
}

/** Familiar single words the bot prefers, so its replies feel human rather than obscure. */
function familiarWords(): Map<string, string[]> {
  if (!familiar) {
    familiar = new Map();
    const dict = load();
    const pool = [...ANIMALS, ...FOODS, ...FRUITS_VEG, ...SPORTS, ...JOBS]
      .filter((e) => e.tier <= 3)
      .map((e) => normalize(e.name))
      .filter((w) => /^[a-z]{3,}$/.test(w) && dict.has(w));
    const extra =
      "apple table window garden river mountain pencil rocket island orange yellow purple silver candle dragon forest planet castle bridge engine number answer energy guitar violin camera button letter mirror pillow ladder marble jacket rabbit tiger zebra eagle lemon melon sugar bread butter cheese coffee honey water ocean desert valley meadow summer winter autumn spring thunder lightning shadow circle square triangle diamond crystal ticket travel journey harbor market palace temple museum school student teacher doctor artist singer player winner yacht umbrella violet orbit galaxy comet nebula velvet whisper puzzle riddle knight wizard giant goblin unicorn phoenix kingdom quest treasure anchor lantern compass voyage harvest festival carnival parade rhythm melody echo".split(
        " ",
      );
    for (const w of [...pool, ...extra.filter((w) => dict.has(w))]) {
      const k = w[0];
      if (!familiar.has(k)) familiar.set(k, []);
      if (!familiar.get(k)!.includes(w)) familiar.get(k)!.push(w);
    }
  }
  return familiar;
}

/** The bot's reply: a familiar word if possible, otherwise a dictionary word. Harder (longer) as turns grow. */
export function botWord(letter: string, used: string[], turns: number): string | null {
  const usedSet = new Set(used);
  const fam = (familiarWords().get(letter) ?? []).filter((w) => !usedSet.has(w));
  // Avoid handing the player an impossible letter.
  const playable = (w: string) => !"xq".includes(w.slice(-1));
  const famOk = fam.filter(playable);
  if (famOk.length && Math.random() < 0.85) return famOk[Math.floor(Math.random() * famOk.length)];
  const minLen = Math.min(9, 4 + Math.floor(turns / 3));
  const candidates: string[] = [];
  for (const w of load()) {
    if (w[0] === letter && w.length >= minLen && w.length <= minLen + 3 && !usedSet.has(w) && playable(w)) {
      candidates.push(w);
      if (candidates.length > 400) break;
    }
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
