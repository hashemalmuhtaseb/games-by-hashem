import { flagsGame } from "./games/flags";
import { moviesGame } from "./games/movies";
import { footballGame } from "./games/football";
import { rareWordsGame } from "./games/rare";
import { celebritiesGame } from "./games/celebs";
import { proxyModes } from "./games/mix";
import { communityMode } from "./games/community";
import { AGGREGATE_SLUGS, EXTRA_GAMES } from "./games/extra";
import { setRiskSources } from "./games/originals";
import type { GameDefinition } from "./types";

const CORE: GameDefinition[] = [flagsGame, moviesGame, footballGame, rareWordsGame, celebritiesGame];

/** Sources whose quick, single-answer questions are suitable for mixed games. */
const MIX_SOURCES = (): GameDefinition[] =>
  [...CORE, ...EXTRA_GAMES].filter((g) => !["rare-words", "hive-mind", "category-battle", "name-five", "connections", "word-forge", "speed-sort"].includes(g.slug) && !g.soloOnly && !AGGREGATE_SLUGS.has(g.slug));

setRiskSources(MIX_SOURCES);

export const triviaRouletteGame: GameDefinition = {
  slug: "roulette",
  name: "Trivia Roulette",
  short: "Every round spins to a different subject. You never know what's next.",
  icon: "🎰",
  accent: ["#14b8a6", "#8b5cf6"],
  group: "party",
  rules: ["Each round is drawn from a different topic — football, film, flags, music, science…", "Topics are weighted away from anything you just saw.", "Speed and streaks multiply your score."],
  get modes() {
    return [...proxyModes("roulette", MIX_SOURCES(), ["choice", "number", "text", "clues", "reveal", "order", "memory"]), communityMode("roulette")];
  },
  rounds: 12,
  timeLimitSec: 15,
  multiplayer: true,
};

export const quickfireGame: GameDefinition = {
  slug: "quickfire",
  name: "Quickfire",
  short: "Ten-second rounds from every game, getting faster as you go.",
  icon: "⚡",
  accent: ["#facc15", "#f97316"],
  group: "party",
  rules: ["Rounds last 10–20 seconds and get shorter as you progress.", "Multiple choice only — trust your gut.", "Streaks are worth a lot here."],
  get modes() {
    return [...proxyModes("quickfire", MIX_SOURCES(), ["choice"], { preferChoice: true }), communityMode("quickfire")];
  },
  rounds: 15,
  timeLimitSec: 12,
  multiplayer: true,
  scoring: { speedBonus: 80, streakStep: 0.15, streakCap: 0.9 },
};

let all: GameDefinition[] | null = null;

export function allGames(): GameDefinition[] {
  if (!all) all = [...CORE, triviaRouletteGame, quickfireGame, ...EXTRA_GAMES];
  return all;
}

export function getGame(slug: string): GameDefinition | undefined {
  return allGames().find((g) => g.slug === slug);
}

/** Static, client-safe catalogue info (no generators, no answers). */
export interface GameInfo {
  slug: string;
  name: string;
  short: string;
  icon: string;
  accent: [string, string];
  group: string;
  original: boolean;
  rules: string[];
  rounds: number;
  timeLimitSec: number;
  multiplayer: boolean;
  soloOnly: boolean;
  modes: { id: string; label: string; description: string; available: boolean; reason?: string }[];
  questionCount: number;
  /** Games with their own screens (Poker) link here instead of /games/<slug>. */
  href?: string;
}
