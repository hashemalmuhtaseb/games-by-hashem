import { CLASSIC_GAMES } from "./classics";
import { ORIGINAL_GAMES } from "./originals";
import type { GameDefinition } from "../types";

/** Phase 5: the rest of the classic party games plus ten PartyVerse originals. */
export const EXTRA_GAMES: GameDefinition[] = [...CLASSIC_GAMES(), ...ORIGINAL_GAMES()];

/** Games that re-use other games' questions; excluded from mixed games so nothing is double-counted. */
export const AGGREGATE_SLUGS = new Set(["emoji", "who-am-i", "guess-the-year", "memory", "risk-reward"]);
