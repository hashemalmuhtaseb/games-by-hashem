import type { Rng } from "./rng";

/**
 * Shared game interfaces.
 *
 * A game is a set of MODES. Each mode can enumerate cheap Candidate descriptors
 * (so the selection engine can weigh every possible question against history)
 * and build a full Round from a chosen candidate.
 *
 * A built Round is split in two: `pub` is safe to send to the browser; `secret`
 * stays on the server until the round is revealed. Anything in `pub` must be
 * assumed visible to the player via dev tools.
 */

export type RoundKind =
  | "choice" // pick one option
  | "text" // type an answer (tolerant matching)
  | "number" // numeric estimate, closeness scoring
  | "clues" // progressive clues, answer by text or option
  | "order" // arrange options in correct order
  | "groups" // connections: find groups of four
  | "multi" // several valid answers (Name Five, Category Battle)
  | "rare" // single answer scored by rarity
  | "sort" // assign each item to one of two buckets
  | "map" // guess a country, get distance/direction feedback
  | "wager" // bet before answering
  | "chain" // word chain against a bot
  | "memory" // study then answer
  | "reveal" // image becomes clearer over time
  | "letters"; // make the longest dictionary word from a set of letters

/** Public name lists used for typing autocomplete. */
export type SuggestSet = "footballers" | "managers" | "clubs";

export type MediaRef =
  | { type: "image"; url: string; alt: string; aspect?: number; frame?: "flag" | "square" | "wide" }
  | { type: "emoji"; value: string }
  | { type: "quote"; text: string; by?: string }
  | { type: "facts"; items: { label: string; value: string }[] }
  | { type: "timeline"; title?: string; items: string[] }
  | { type: "audio"; url: string; attribution: string }
  | { type: "words"; items: string[] };

export interface OptionPublic {
  id: string;
  label: string;
  sub?: string;
  media?: MediaRef;
}

export interface PublicRound {
  roundId: string;
  kind: RoundKind;
  gameSlug: string;
  mode: string;
  modeLabel: string;
  prompt: string;
  media?: MediaRef[];
  options?: OptionPublic[];
  timeLimitSec: number;
  totalClues?: number;
  input?: {
    placeholder?: string;
    /** Name list the client offers as autocomplete (the whole pool, so it never hints at the answer). */
    suggest?: SuggestSet;
    numeric?: { min: number; max: number; step: number; unit?: string; log?: boolean };
    target?: number; // number of answers wanted (multi)
    letter?: string;
  };
  buckets?: [string, string];
  extra?: Record<string, unknown>;
  topic: string;
  difficulty: number;
  repeat?: { daysAgo: number };
  generatedBy?: "dataset" | "ai" | "admin" | "import";
}

export interface SecretRound {
  answerLabel: string;
  correctOptionId?: string;
  accept?: string[];
  numeric?: { value: number; unit?: string; scale: "linear" | "log"; tolerance: number };
  order?: string[];
  groups?: { label: string; ids: string[]; level: number }[];
  clues?: string[];
  stages?: MediaRef[]; // per-clue media (progressive reveal)
  explanation?: string;
  source?: string;
  data?: Record<string, unknown>;
}

export interface Round {
  gameSlug: string;
  handler: RoundKind;
  contentKey: string;
  subjectKey: string;
  topic: string;
  difficulty: number;
  pub: Omit<PublicRound, "roundId" | "repeat">;
  secret: SecretRound;
}

export interface Candidate {
  key: string; // contentKey
  subject: string; // subjectKey
  topic: string;
  difficulty: number; // 1..5
  mode: string;
  gameSlug: string;
  ref: string; // generator-specific reference (dataset item id etc.)
  variant?: number;
  isNew?: boolean;
}

export interface BuildContext {
  rng: Rng;
  /** Seconds per round chosen by the room or mode. */
  timeLimitSec?: number;
  hintsEnabled?: boolean;
  /** Mixed fast games ask modes that can do either to produce multiple choice. */
  preferChoice?: boolean;
  /** Registers server-rendered media and returns an opaque URL. */
  media: MediaRegistry;
}

export interface MediaRegistry {
  flag(iso2: string, opts?: FlagRender): string;
}

export interface FlagRender {
  crop?: { x: number; y: number; w: number; h: number }; // fractions 0..1
  blur?: number; // sigma
  pixelate?: number; // target width in px before upscaling
  grayscale?: boolean;
  width?: number;
}

export interface ModeDefinition {
  id: string;
  label: string;
  /** Round kinds this mode can produce (used by mixed games to pick compatible modes). */
  kinds: RoundKind[];
  description: string;
  candidates(): Candidate[];
  build(c: Candidate, ctx: BuildContext): Round | Promise<Round>;
  /** Unavailable modes are hidden (e.g. missing licence/credentials) with the reason shown to admins. */
  unavailableReason?: () => string | null;
}

export type GameGroup = "visual" | "trivia" | "words" | "sports" | "party";

export interface GameDefinition {
  slug: string;
  name: string;
  short: string;
  icon: string;
  accent: [string, string]; // gradient colors
  group: GameGroup;
  original?: boolean;
  rules: string[];
  modes: ModeDefinition[];
  rounds: number;
  timeLimitSec: number;
  multiplayer: boolean;
  /** Games that only make sense solo (e.g. word chain vs bot) */
  soloOnly?: boolean;
  scoring?: Partial<ScoringConfig>;
}

export interface ScoringConfig {
  base: number;
  speedBonus: number;
  difficultyMultiplier: number[]; // index = difficulty-1
  streakStep: number;
  streakCap: number;
  cluePenalty: number; // fraction lost per extra clue used
  wrongAttemptPenalty: number;
  minCorrectPoints: number;
}

export interface PointsBreakdown {
  base: number;
  speed: number;
  difficulty: number;
  streak: number;
  rarity?: number;
  /** Multiplayer numeric rounds: bonus for the closest guess. */
  closest?: number;
  total: number;
}

export interface PlayerRoundState {
  startedAt: number;
  cluesUsed: number;
  attempts: unknown[];
  done: boolean;
  correct: boolean;
  quality: number; // 0..1 how good the final answer was
  points: number;
  breakdown?: PointsBreakdown;
  answerLabel?: string; // what the player answered, human readable
  data: Record<string, unknown>;
}

export type Action =
  | { type: "answer"; value: unknown }
  | { type: "hint" }
  | { type: "give-up" }
  | { type: "bet"; value: number }
  | { type: "ready" }
  | { type: "finish" };

export interface ActContext {
  now: number;
  streak: number;
  playerId: string;
  scoring: ScoringConfig;
  /** Multiplayer: other submissions in the room for uniqueness bonuses. */
  roomSize?: number;
  services: EngineServices;
}

export interface EngineServices {
  rarity: import("./rarity").RarityStore;
}

export interface ActResult {
  /** Feedback that is safe to show immediately (never contains hidden answers unless done). */
  feedback?: Record<string, unknown>;
  /** New public info, e.g. a newly revealed clue. */
  reveal?: Record<string, unknown>;
  error?: string;
}

export interface RoundHandler {
  initState?(round: Round): Partial<PlayerRoundState>;
  act(round: Round, state: PlayerRoundState, action: Action, ctx: ActContext): ActResult | Promise<ActResult>;
  /** Called when the timer ends for a player who never finished. */
  timeout?(round: Round, state: PlayerRoundState, ctx: ActContext): void;
}

export interface RevealPayload {
  answerLabel: string;
  /** Lets players report a problem with this exact question (only sent after the reveal). */
  contentKey?: string;
  correctOptionId?: string;
  order?: string[];
  groups?: { label: string; ids: string[]; level: number }[];
  explanation?: string;
  source?: string;
  extra?: Record<string, unknown>;
}
