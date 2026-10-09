import { MOVIES, MOVIE_BY_ID, movieNames, type Movie } from "@/content/datasets/movies";
import { choiceRound, cluesRound, numberRound, pickDistinct, textRound } from "../build";
import { pick, sample, shuffle } from "../rng";
import { compact } from "../normalize";
import type { BuildContext, Candidate, GameDefinition, ModeDefinition } from "../types";

const SLUG = "movies";
const SRC = "Movie facts: public record (reference date 2025-06). Plot summaries are original.";

function cand(mode: string, m: Movie, bump = 0, variant = 0): Candidate {
  return {
    key: `movie:${mode}:${m.id}${variant ? `:${variant}` : ""}`,
    subject: `movie:${m.id}`,
    topic: `movies/${m.genres[0] ?? "film"}`,
    difficulty: Math.max(1, Math.min(5, m.difficulty + bump)),
    mode,
    gameSlug: SLUG,
    ref: m.id,
    variant,
  };
}

/** Distractor movies: similar era/genre at higher difficulty so the answer can't be guessed by vibe. */
function distractors(ctx: BuildContext, m: Movie, n: number, hard: boolean): Movie[] {
  const similar = MOVIES.filter((x) => x.id !== m.id && (x.genres.some((g) => m.genres.includes(g)) || Math.abs(x.year - m.year) <= 8));
  const pool = hard && similar.length >= n ? similar : MOVIES.filter((x) => x.id !== m.id);
  return pickDistinct(ctx.rng, pool, n, (x) => x.title);
}

/** Characters whose names don't give the title away (no "Shrek" in "Shrek"). */
function safeCharacters(m: Movie): string[] {
  const titles = movieNames(m).map(compact);
  return m.characters.filter((ch) => {
    const k = compact(ch);
    return !titles.some((t) => t.includes(k) || k.includes(t) || ch.split(/\s+/).some((w) => w.length > 3 && t.includes(compact(w))));
  });
}

const opt = (m: Movie) => ({ label: m.title, sub: String(m.year) });

const emoji: ModeDefinition = {
  id: "emoji",
  kinds: ["choice", "text"],
  label: "Emoji movie",
  description: "Decode the emoji to name the film.",
  candidates: () => MOVIES.map((m) => cand("emoji", m)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    if (c.difficulty >= 3 && !ctx.preferChoice)
      return textRound({ c, modeLabel: "Emoji movie", prompt: "Which movie is this?", media: [{ type: "emoji", value: m.emoji }], timeLimitSec: ctx.timeLimitSec ?? 25, accept: movieNames(m), answerLabel: m.title, explanation: `${m.title} (${m.year}) — ${m.plot}`, source: SRC });
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Emoji movie", prompt: "Which movie is this?", media: [{ type: "emoji", value: m.emoji }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: opt(m), distractors: distractors(ctx, m, 3, true).map(opt), explanation: `${m.title} (${m.year}) — ${m.plot}`, source: SRC });
  },
};

const quote: ModeDefinition = {
  id: "quote",
  kinds: ["choice"],
  label: "Famous quote",
  description: "Which film is this famous line from?",
  candidates: () => MOVIES.filter((m) => m.quote).map((m) => cand("quote", m)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Famous quote", prompt: "Which movie features this line?", media: [{ type: "quote", text: m.quote! }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: opt(m), distractors: distractors(ctx, m, 3, true).map(opt), explanation: `“${m.quote}” — ${m.title} (${m.year})`, source: SRC });
  },
};

const plot: ModeDefinition = {
  id: "plot",
  kinds: ["choice"],
  label: "The plot",
  description: "Identify the film from a one-line plot.",
  candidates: () => MOVIES.map((m) => cand("plot", m)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "The plot", prompt: m.plot, timeLimitSec: ctx.timeLimitSec ?? 20, correct: opt(m), distractors: distractors(ctx, m, 3, true).map(opt), explanation: `${m.title} (${m.year}), directed by ${m.director}.`, source: SRC });
  },
};

const character: ModeDefinition = {
  id: "character",
  kinds: ["text"],
  label: "Character names",
  description: "These characters all appear in one film.",
  candidates: () => MOVIES.filter((m) => safeCharacters(m).length >= 2).map((m) => cand("character", m, 1)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    return textRound({ c, modeLabel: "Character names", prompt: "Which film features these characters?", media: [{ type: "words", items: safeCharacters(m) }], timeLimitSec: ctx.timeLimitSec ?? 25, accept: movieNames(m), answerLabel: m.title, placeholder: "Movie title…", explanation: `${m.characters.join(", ")} — ${m.title} (${m.year}).`, source: SRC });
  },
};

const year: ModeDefinition = {
  id: "year",
  kinds: ["number"],
  label: "Release year",
  description: "Guess when it came out — the closer, the better.",
  candidates: () => MOVIES.map((m) => cand("year", m, 1)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    return numberRound({ c, modeLabel: "Release year", prompt: `In what year was “${m.title}” released?`, media: [{ type: "emoji", value: m.emoji }], timeLimitSec: ctx.timeLimitSec ?? 20, value: m.year, min: 1920, max: new Date().getUTCFullYear(), tolerance: 4, explanation: `${m.title} was released in ${m.year}.`, source: SRC });
  },
};

const director: ModeDefinition = {
  id: "director",
  kinds: ["choice"],
  label: "Who directed it?",
  description: "Name the director behind the film.",
  candidates: () => MOVIES.map((m) => cand("director", m, 1)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    const others = pickDistinct(ctx.rng, MOVIES.filter((x) => x.director !== m.director && x.director), 3, (x) => x.director);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Who directed it?", prompt: `Who directed “${m.title}” (${m.year})?`, timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: m.director }, distractors: others.map((o) => ({ label: o.director })), explanation: `${m.title} was directed by ${m.director}.`, source: SRC });
  },
};

// Actors with at least three films in the dataset → "guess the actor from their filmography".
const ACTOR_FILMS = (() => {
  const map = new Map<string, Movie[]>();
  for (const m of MOVIES) for (const s of m.stars) map.set(s, [...(map.get(s) ?? []), m]);
  return [...map.entries()].filter(([, ms]) => ms.length >= 3);
})();

const filmography: ModeDefinition = {
  id: "filmography",
  kinds: ["clues"],
  label: "Filmography",
  description: "Name the actor who starred in all of these.",
  candidates: () =>
    ACTOR_FILMS.map(([actor, films]) => ({ key: `movie:filmography:${actor}`, subject: `actor:${actor}`, topic: "movies/actors", difficulty: films.length >= 5 ? 2 : 3, mode: "filmography", gameSlug: SLUG, ref: actor })),
  build(c, ctx) {
    const films = ACTOR_FILMS.find(([a]) => a === c.ref)![1];
    const shown = sample(ctx.rng, films, Math.min(4, films.length)).sort((a, b) => a.year - b.year);
    const surname = c.ref.split(" ").slice(-1)[0];
    return cluesRound({
      c, modeLabel: "Filmography", prompt: "Which actor starred in all of these films?",
      clues: shown.map((f) => `${f.title} (${f.year})`), accept: [c.ref, surname.length > 4 ? surname : c.ref], answerLabel: c.ref,
      timeLimitSec: ctx.timeLimitSec ?? 30, explanation: `${c.ref}: ${films.map((f) => f.title).join(", ")}.`, source: SRC,
    });
  },
};

const firstOf: ModeDefinition = {
  id: "first",
  kinds: ["choice"],
  label: "Which came first?",
  description: "Pick the oldest film of four.",
  candidates: () => Array.from({ length: 200 }, (_, i) => ({ key: `movie:first:${i}`, subject: `moviefirst:${i}`, topic: "movies/history", difficulty: 2 + (i % 3), mode: "first", gameSlug: SLUG, ref: String(i) })),
  build(c, ctx) {
    // Ensure distinct years so there is exactly one right answer.
    const pool = shuffle(ctx.rng, MOVIES);
    const chosen: Movie[] = [];
    for (const m of pool) {
      if (chosen.some((x) => Math.abs(x.year - m.year) < (c.difficulty >= 4 ? 1 : 3))) continue;
      chosen.push(m);
      if (chosen.length === 4) break;
    }
    const oldest = chosen.reduce((a, b) => (a.year < b.year ? a : b));
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Which came first?", prompt: "Which of these films was released first?", timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: oldest.title }, distractors: chosen.filter((x) => x !== oldest).map((x) => ({ label: x.title })), explanation: chosen.sort((a, b) => a.year - b.year).map((x) => `${x.title} (${x.year})`).join(" · "), source: SRC });
  },
};

const bestPicture: ModeDefinition = {
  id: "oscar",
  kinds: ["choice"],
  label: "Best Picture?",
  description: "Which of these won the Academy Award for Best Picture?",
  candidates: () => MOVIES.filter((m) => m.bestPicture).map((m) => cand("oscar", m, 1)),
  build(c, ctx) {
    const m = MOVIE_BY_ID.get(c.ref)!;
    const ds = pickDistinct(ctx.rng, MOVIES.filter((x) => !x.bestPicture && x.difficulty <= 3), 3, (x) => x.id);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Best Picture?", prompt: "Only one of these won the Oscar for Best Picture. Which?", timeLimitSec: ctx.timeLimitSec ?? 15, correct: opt(m), distractors: ds.map(opt), explanation: `${m.title} (${m.year}) won Best Picture.`, source: SRC });
  },
};

// Poster-based modes need a licensed image source; they explain themselves instead of faking it.
const posterUnavailable = (id: string, label: string): ModeDefinition => ({
  id,
  kinds: ["choice"],
  label,
  description: "Requires a licensed poster provider (e.g. TMDB API key).",
  unavailableReason: () => (process.env.TMDB_API_KEY ? null : "Set TMDB_API_KEY to enable poster modes (TMDB terms require attribution)."),
  candidates: () => [],
  build: () => {
    throw new Error("poster provider not configured");
  },
});

export const moviesGame: GameDefinition = {
  slug: SLUG,
  name: "Guess the Movie",
  short: "Emoji, quotes, plots, characters, directors and release years across 90 years of cinema.",
  icon: "🎬",
  accent: ["#f43f5e", "#f59e0b"],
  group: "trivia",
  rules: ["Identify the movie from the clue shown.", "Some rounds are multiple choice, harder ones ask you to type.", "Year rounds score by how close you are."],
  modes: [emoji, quote, plot, character, year, director, filmography, firstOf, bestPicture, posterUnavailable("poster", "Poster"), posterUnavailable("blurred", "Blurred poster")],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

export { pick };
