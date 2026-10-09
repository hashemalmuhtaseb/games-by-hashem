import { CATEGORIES, CATEGORY_BY_ID, viableLetters } from "@/content/categories";
import { genericRound } from "../build";
import type { Candidate, GameDefinition, ModeDefinition } from "../types";

const SLUG = "rare-words";

function catMode(catId: string): ModeDefinition {
  const cat = CATEGORY_BY_ID.get(catId)!;
  return {
    id: cat.id,
    kinds: ["rare"],
    label: cat.label,
    description: cat.prompt,
    candidates() {
      const out: Candidate[] = [{ key: `rare:${cat.id}`, subject: `rarecat:${cat.id}`, topic: `rare/${cat.id}`, difficulty: 2, mode: cat.id, gameSlug: SLUG, ref: "" }];
      // Letter-constrained variants keep the same category fresh for a long time.
      for (const l of viableLetters(cat, 12)) out.push({ key: `rare:${cat.id}:${l}`, subject: `rarecat:${cat.id}:${l}`, topic: `rare/${cat.id}`, difficulty: 3, mode: cat.id, gameSlug: SLUG, ref: l });
      return out;
    },
    build(c, ctx) {
      const letter = c.ref || undefined;
      return genericRound(
        "rare",
        { c, modeLabel: `${cat.icon} ${cat.label}`, prompt: letter ? `${cat.prompt} starting with “${letter}”` : cat.prompt, timeLimitSec: ctx.timeLimitSec ?? 25 },
        { answerLabel: "Any valid, rare answer", data: { categoryId: cat.id, letter }, explanation: "The rarer your valid answer, the more points it earns. Rarity is learned from every player's answers." },
        { input: { placeholder: "Think rare…", letter } },
      );
    },
  };
}

export const rareWordsGame: GameDefinition = {
  slug: SLUG,
  name: "Rare Words",
  short: "Name something in the category — the rarer your valid answer, the bigger the score.",
  icon: "💎",
  accent: ["#a855f7", "#ec4899"],
  group: "words",
  rules: [
    "You get a category (sometimes with a starting letter). Type ONE valid answer.",
    "Common answers earn ~10–25 points; genuinely rare correct answers earn up to 100.",
    "Invalid or made-up answers lose 10 points. Typos and aliases are recognised.",
    "Rarity is learned live from all players — each player counts once per answer, so it can't be farmed.",
  ],
  modes: CATEGORIES.map((c) => catMode(c.id)),
  rounds: 8,
  timeLimitSec: 25,
  multiplayer: true,
  scoring: { speedBonus: 0 },
};
