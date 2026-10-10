import { CLUBS, FOOTBALLERS, MANAGERS } from "./datasets/football";
import type { SuggestSet } from "@/engine/types";
import { diagnosisNames } from "./datasets/medical";

/** Every name in a pool, sorted. Sent whole to the browser, so it reveals nothing about the current answer. */
export const SUGGEST_SETS: Record<SuggestSet, () => string[]> = {
  footballers: () => FOOTBALLERS.map((p) => p.name),
  managers: () => MANAGERS.map((m) => m.name),
  clubs: () => CLUBS.map((c) => c.name),
  diagnoses: diagnosisNames,
};

export function suggestNames(set: SuggestSet): string[] {
  return [...new Set(SUGGEST_SETS[set]())].sort((a, b) => a.localeCompare(b));
}
