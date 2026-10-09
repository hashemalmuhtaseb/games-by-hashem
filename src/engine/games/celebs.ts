import { CELEBRITIES, CELEB_BY_ID, type Celebrity } from "@/content/datasets/celebrities";
import { choiceRound, cluesRound, currentYear, numberRound, pickDistinct } from "../build";
import type { BuildContext, Candidate, GameDefinition, ModeDefinition } from "../types";

const SLUG = "celebrities";
const SRC = "Public record, reference date 2025-06.";

function names(c: Celebrity) {
  return [c.name, ...(c.aliases ?? [])];
}

function cand(mode: string, p: Celebrity, bump = 0): Candidate {
  return { key: `celeb:${mode}:${p.id}`, subject: `celeb:${p.id}`, topic: `celebs/${p.profession.toLowerCase()}`, difficulty: Math.max(1, Math.min(5, p.difficulty + bump)), mode, gameSlug: SLUG, ref: p.id };
}

function similar(ctx: BuildContext, p: Celebrity, n: number): Celebrity[] {
  const same = CELEBRITIES.filter((x) => x.id !== p.id && x.profession === p.profession);
  return pickDistinct(ctx.rng, same.length >= n ? same : CELEBRITIES.filter((x) => x.id !== p.id), n, (x) => x.name);
}

const clues: ModeDefinition = {
  id: "clues",
  kinds: ["clues"],
  label: "Who am I?",
  description: "Clues go from vague to obvious. Answer early for big points.",
  candidates: () => CELEBRITIES.map((p) => cand("clues", p)),
  build(c, ctx) {
    const p = CELEB_BY_ID.get(c.ref)!;
    return cluesRound({ c, modeLabel: "Who am I?", prompt: "Which famous person am I?", clues: p.clues, accept: names(p), answerLabel: p.name, timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `${p.name} — ${p.role} (${p.nationality}). Known for: ${p.knownFor.join(", ")}.`, source: SRC });
  },
};

const emoji: ModeDefinition = {
  id: "emoji",
  kinds: ["choice"],
  label: "Emoji celebrity",
  description: "Decode the emoji.",
  candidates: () => CELEBRITIES.map((p) => cand("emoji", p, 1)),
  build(c, ctx) {
    const p = CELEB_BY_ID.get(c.ref)!;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Emoji celebrity", prompt: "Who do these emoji describe?", media: [{ type: "emoji", value: p.emoji }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: similar(ctx, p, 3).map((x) => ({ label: x.name })), explanation: `${p.name}: ${p.knownFor.join(", ")}.`, source: SRC });
  },
};

const knownFor: ModeDefinition = {
  id: "knownfor",
  kinds: ["choice"],
  label: "Career clues",
  description: "Name the star from what they're known for.",
  candidates: () => CELEBRITIES.map((p) => cand("knownfor", p)),
  build(c, ctx) {
    const p = CELEB_BY_ID.get(c.ref)!;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Career clues", prompt: `Which ${p.role} is known for these?`, media: [{ type: "words", items: p.knownFor }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: similar(ctx, p, 3).map((x) => ({ label: x.name })), explanation: `${p.name}.`, source: SRC });
  },
};

const age: ModeDefinition = {
  id: "age",
  kinds: ["number"],
  label: "How old?",
  description: "Guess their age this year. Closer is better.",
  candidates: () => CELEBRITIES.filter((p) => !p.died).map((p) => cand("age", p, 1)),
  build(c, ctx) {
    const p = CELEB_BY_ID.get(c.ref)!;
    const y = currentYear();
    const ageNow = y - p.born; // birthday may not have passed yet: true age is this or one less
    return numberRound({ c, modeLabel: "How old?", prompt: `How old does ${p.name} turn in ${y}?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: ageNow, min: 10, max: 100, tolerance: 3, unit: "years", explanation: `${p.name} was born in ${p.born}, so turns ${ageNow} in ${y}.`, source: SRC });
  },
};

const nationality: ModeDefinition = {
  id: "nationality",
  kinds: ["choice"],
  label: "Nationality",
  description: "Where are they from?",
  candidates: () => CELEBRITIES.map((p) => cand("nationality", p, 1)),
  build(c, ctx) {
    const p = CELEB_BY_ID.get(c.ref)!;
    const nats = [...new Set(CELEBRITIES.map((x) => x.nationality))].filter((n) => n !== p.nationality);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Nationality", prompt: `What nationality is ${p.name}?`, timeLimitSec: ctx.timeLimitSec ?? 12, correct: { label: p.nationality }, distractors: pickDistinct(ctx.rng, nats, 3, (x) => x).map((x) => ({ label: x })), explanation: `${p.name} is from ${p.nationality}.`, source: SRC });
  },
};

const photoUnavailable = (id: string, label: string): ModeDefinition => ({
  id,
  kinds: ["choice"],
  label,
  description: "Needs licensed photos.",
  unavailableReason: () => "Face, silhouette and childhood-photo modes need properly licensed images (not bundled).",
  candidates: () => [],
  build: () => {
    throw new Error("no licensed photos");
  },
});

export const celebritiesGame: GameDefinition = {
  slug: SLUG,
  name: "Guess the Celebrity",
  short: "Actors, musicians, athletes and icons — from emoji to age guesses.",
  icon: "🌟",
  accent: ["#f59e0b", "#ef4444"],
  group: "trivia",
  rules: ["Identify the famous person from clues, emoji or their career.", "‘Who am I?’ clues get easier — every extra clue costs points.", "Age rounds: we ask the age they turn this year."],
  modes: [clues, emoji, knownFor, age, nationality, photoUnavailable("blurred", "Blurred face"), photoUnavailable("silhouette", "Silhouette")],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};
