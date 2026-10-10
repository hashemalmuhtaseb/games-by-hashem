/**
 * Phase 5 games built on the shared datasets. Every fact used here comes from a dataset field
 * (see src/content/datasets/*), never from free text, so questions stay verifiable.
 */
import { COUNTRIES, type Country } from "@/content/datasets/countries";
import { MOVIES, type Movie } from "@/content/datasets/movies";
import { SONGS, SONG_BY_ID, songArtistNames, type Song } from "@/content/datasets/songs";
import { CELEBRITIES, type Celebrity } from "@/content/datasets/celebrities";
import { CLUBS, FOOTBALLERS, MANAGERS, UCL_WINNERS, WORLD_CUPS, type Footballer } from "@/content/datasets/football";
import { CATEGORIES, CATEGORY_BY_ID, resolveAnswer, viableLetters, firstLetter, letterCount, type Category } from "@/content/categories";
import { choiceRound, cluesRound, decadeOf, genericRound, makeOptions, numberRound, orderRound, pickDistinct, revealRound, textRound } from "../build";
import { compact } from "../normalize";
import { pick, randInt, sample, shuffle, type Rng } from "../rng";
import { moviesGame } from "./movies";
import { celebritiesGame } from "./celebs";
import { footballGame } from "./football";
import { FLAG_COUNTRIES, flagsGame } from "./flags";
import { previewProvider } from "@/content/providers/itunes";
import type { BuildContext, Candidate, GameDefinition, MediaRef, ModeDefinition, Round } from "../types";

// ───────────────────────── shared helpers ─────────────────────────

export const SOVEREIGN = COUNTRIES.filter((c) => c.independent || c.unMember);
/** Countries commonly counted on more than one continent — excluded from "which continent" style questions. */
export const TRANSCONTINENTAL = new Set(["RU", "TR", "KZ", "AZ", "GE", "AM", "CY", "EG", "ID", "PA", "TL", "PG"]);
const COUNTRY_SRC = "Country data: mledoze/countries (ODbL).";
const MOVIE_SRC = "Movie facts: public record (reference date 2025-06).";
const SONG_SRC = "Song facts: public record. No audio or lyrics are bundled.";
const CELEB_SRC = "Public record, reference date 2025-06.";
const FB_SRC = "Football data: public record, reference date 2025-08.";

function indexCands(slug: string, mode: string, n: number, topic: string, diffs: number[] = [1, 2, 3, 4], prefix = slug): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({ key: `${prefix}:${mode}:${i}`, subject: `${prefix}:${mode}:${i}`, topic, difficulty: diffs[i % diffs.length], mode, gameSlug: slug, ref: String(i) }));
}

function singleNameEntries(cat: Category, maxTier: number) {
  return cat.entries.filter((e) => e.tier <= maxTier);
}

function songCand(slug: string, mode: string, s: Song, bump = 0): Candidate {
  return { key: `song:${mode}:${s.id}`, subject: `song:${s.id}`, topic: `music/${s.genre}`, difficulty: Math.max(1, Math.min(5, s.difficulty + bump)), mode, gameSlug: slug, ref: s.id };
}

function songOpt(s: Song) {
  return { label: s.title, sub: s.artist };
}

function similarSongs(rng: Rng, s: Song, n: number): Song[] {
  const same = SONGS.filter((x) => x.id !== s.id && x.genre === s.genre && x.artist !== s.artist);
  return pickDistinct(rng, same.length >= n ? same : SONGS.filter((x) => x.id !== s.id && x.artist !== s.artist), n, (x) => x.title);
}

// ───────────────────────── Guess the Song ─────────────────────────

const SONGS_SLUG = "songs";

const songEmoji: ModeDefinition = {
  id: "emoji",
  kinds: ["choice", "text"],
  label: "Emoji song",
  description: "Decode the emoji into a song title.",
  candidates: () => SONGS.map((s) => songCand(SONGS_SLUG, "emoji", s)),
  build(c, ctx) {
    const s = SONG_BY_ID.get(c.ref)!;
    if (c.difficulty >= 4 && !ctx.preferChoice)
      return textRound({ c, modeLabel: "Emoji song", prompt: `Which song by ${s.artist} is this?`, media: [{ type: "emoji", value: s.emoji }], timeLimitSec: ctx.timeLimitSec ?? 25, accept: [s.title, ...(s.aliases ?? [])], answerLabel: s.title, placeholder: "Song title…", explanation: `“${s.title}” — ${s.artist}${s.year ? ` (${s.year})` : ""}. ${s.description}`, source: SONG_SRC });
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Emoji song", prompt: "Which song do these emoji describe?", media: [{ type: "emoji", value: s.emoji }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: songOpt(s), distractors: similarSongs(ctx.rng, s, 3).map(songOpt), explanation: `“${s.title}” — ${s.artist}. ${s.description}`, source: SONG_SRC });
  },
};

const songDescription: ModeDefinition = {
  id: "description",
  kinds: ["choice"],
  label: "What's it about?",
  description: "Identify the song from a description of it.",
  candidates: () => SONGS.map((s) => songCand(SONGS_SLUG, "description", s)),
  build(c, ctx) {
    const s = SONG_BY_ID.get(c.ref)!;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "What's it about?", prompt: s.description, timeLimitSec: ctx.timeLimitSec ?? 20, correct: songOpt(s), distractors: similarSongs(ctx.rng, s, 3).map(songOpt), explanation: `“${s.title}” — ${s.artist}${s.year ? ` (${s.year})` : ""}.`, source: SONG_SRC });
  },
};

const songArtist: ModeDefinition = {
  id: "artist",
  kinds: ["choice"],
  label: "Who sang it?",
  description: "Name the artist behind the track.",
  candidates: () => SONGS.map((s) => songCand(SONGS_SLUG, "artist", s, 0)),
  build(c, ctx) {
    const s = SONG_BY_ID.get(c.ref)!;
    const others = pickDistinct(ctx.rng, SONGS.filter((x) => x.artist !== s.artist && (x.genre === s.genre || ctx.rng() < 0.3)), 3, (x) => x.artist);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Who sang it?", prompt: `Who released “${s.title}”${s.year ? ` (${s.year})` : ""}?`, timeLimitSec: ctx.timeLimitSec ?? 12, correct: { label: s.artist }, distractors: others.map((o) => ({ label: o.artist })), explanation: `“${s.title}” is by ${s.artist}.`, source: SONG_SRC });
  },
};

const songYear: ModeDefinition = {
  id: "year",
  kinds: ["number"],
  label: "Release year",
  description: "When did it come out?",
  candidates: () => SONGS.filter((s) => s.year).map((s) => songCand(SONGS_SLUG, "year", s, 1)),
  build(c, ctx) {
    const s = SONG_BY_ID.get(c.ref)!;
    return numberRound({ c, modeLabel: "Release year", prompt: `In what year was “${s.title}” by ${s.artist} released?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: s.year!, min: 1950, max: new Date().getUTCFullYear(), tolerance: 4, explanation: `“${s.title}” came out in ${s.year}.`, source: SONG_SRC });
  },
};

const songOrder: ModeDefinition = {
  id: "timeline",
  kinds: ["order"],
  label: "Song timeline",
  description: "Put four hits in release order.",
  candidates: () => indexCands(SONGS_SLUG, "timeline", 150, "music/timeline", [2, 3, 3, 4], "song"),
  build(c, ctx) {
    const chosen: Song[] = [];
    for (const s of shuffle(ctx.rng, SONGS.filter((x) => x.year))) {
      if (chosen.some((x) => Math.abs(x.year! - s.year!) < 2)) continue;
      chosen.push(s);
      if (chosen.length === 4) break;
    }
    chosen.sort((a, b) => a.year! - b.year!);
    return orderRound({ c, rng: ctx.rng, modeLabel: "Song timeline", prompt: "Oldest first: put these songs in release order.", timeLimitSec: ctx.timeLimitSec ?? 30, items: chosen.map((s) => ({ label: s.title, sub: s.artist })), labels: ["Oldest", "Newest"], explanation: chosen.map((s) => `${s.title} (${s.year})`).join(" → "), source: SONG_SRC });
  },
};

const songAudio: ModeDefinition = {
  id: "audio",
  kinds: ["choice"],
  label: "Listen & guess",
  description: "Hear a 30-second preview and name the song.",
  unavailableReason: () => previewProvider.unavailableReason(),
  candidates: () => SONGS.map((s) => songCand(SONGS_SLUG, "audio", s, 0)),
  async build(c, ctx) {
    const s = SONG_BY_ID.get(c.ref)!;
    const preview = await previewProvider.find(s);
    if (!preview) throw new Error("no-preview");
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Listen & guess", prompt: "Which song is this?", media: [{ type: "audio", url: preview.url, attribution: preview.attribution }], timeLimitSec: ctx.timeLimitSec ?? 30, correct: songOpt(s), distractors: similarSongs(ctx.rng, s, 3).map(songOpt), explanation: `“${s.title}” — ${s.artist}.`, source: preview.attribution });
  },
};

export const songsGame: GameDefinition = {
  slug: SONGS_SLUG,
  name: "Guess the Song",
  short: "Emoji riddles, descriptions, artists and release years — pop, Arabic, K-pop, Latin and more.",
  icon: "🎵",
  accent: ["#ec4899", "#8b5cf6"],
  group: "trivia",
  rules: ["Name the song or artist from emoji, a description, or its era.", "No lyrics or audio are bundled (copyright). Audio previews switch on only when a licensed preview provider is configured.", "Faster correct answers score more."],
  modes: [songEmoji, songDescription, songArtist, songYear, songOrder, songAudio],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

// ───────────────────────── Word Chain ─────────────────────────

const CHAIN_SLUG = "word-chain";

const STARTERS = "apple river garden planet orange castle dragon forest island rocket violin harbor marble candle silver summer winter jacket pencil window tiger zebra eagle lemon melon puzzle anchor lantern compass voyage harvest melody rhythm mirror ladder pillow butter coffee desert meadow valley engine button letter number energy guitar camera".split(" ");

function chainMode(id: string, label: string, description: string, categoryId: string | undefined, count: number): ModeDefinition {
  return {
    id,
    kinds: ["chain"],
    label,
    description,
    candidates: () => indexCands(CHAIN_SLUG, id, count, `words/chain-${id}`, [2, 3, 3, 4], "chain"),
    build(c, ctx) {
      let start: string;
      let display: string;
      if (categoryId) {
        const cat = CATEGORY_BY_ID.get(categoryId)!;
        const pool = cat.entries.filter((e) => e.tier <= 2).map((e) => ({ display: e.name, w: compact(e.name) })).filter((x) => /^[a-z]{4,}$/.test(x.w) && !"xqz".includes(x.w.slice(-1)));
        const s = pick(ctx.rng, pool);
        start = s.w;
        display = s.display;
      } else {
        start = pick(ctx.rng, STARTERS);
        display = start;
      }
      const turnSec = Math.max(7, 14 - c.difficulty);
      const minLen = categoryId ? 3 : 2 + Math.min(3, c.difficulty);
      return genericRound(
        "chain",
        { c, modeLabel: label, prompt: categoryId ? `${label}: each answer must start with the last letter of the previous one.` : "Each word must start with the last letter of the previous word.", timeLimitSec: ctx.timeLimitSec ?? 120 },
        { answerLabel: "Keep the chain alive!", data: { start, turnSec, minLen, categoryId }, explanation: "Words are checked against a 275,000-word English dictionary (or the category's answer list). No repeats." },
        { extra: { start: display.toLowerCase(), turnSec, minLen } },
      );
    },
  };
}

export const wordChainGame: GameDefinition = {
  slug: CHAIN_SLUG,
  name: "Word Chain",
  short: "Battle a bot: each word starts with the last letter of the one before. Don't run out of time.",
  icon: "🔗",
  accent: ["#22c55e", "#06b6d4"],
  group: "words",
  rules: ["Type a word starting with the last letter of the previous word.", "No repeats, real words only, and the minimum length grows as you go.", "Your turn timer shrinks every few words. Make the bot give up for +50."],
  modes: [
    chainMode("dictionary", "Any word", "Any English dictionary word.", undefined, 300),
    chainMode("countries", "Country chain", "Countries only — Spain → Nepal → Laos…", "countries", 80),
    chainMode("animals", "Animal chain", "Animals only.", "animals", 80),
    chainMode("cities", "City chain", "Cities only.", "cities", 80),
  ],
  rounds: 3,
  timeLimitSec: 120,
  multiplayer: false,
  soloOnly: true,
  scoring: { speedBonus: 0 },
};

// ───────────────────────── Category Battle & Name Five ─────────────────────────

const BATTLE_SLUG = "category-battle";
const BATTLE_CATS = ["animals", "countries", "capitals", "cities", "foods", "fruitveg", "carbrands", "brands", "musicians", "actors", "movies", "footballers", "videogames", "fictional", "famous", "sports", "jobs", "elements", "usstates", "languages"];

function battleMode(catId: string): ModeDefinition {
  const cat = CATEGORY_BY_ID.get(catId)!;
  return {
    id: cat.id,
    kinds: ["multi"],
    label: cat.label,
    description: `${cat.prompt} — as many as you can.`,
    candidates() {
      const out: Candidate[] = [];
      for (const l of viableLetters(cat, 10)) out.push({ key: `battle:${cat.id}:${l}`, subject: `battle:${cat.id}:${l}`, topic: `battle/${cat.id}`, difficulty: 2, mode: cat.id, gameSlug: BATTLE_SLUG, ref: l });
      return out;
    },
    build(c, ctx) {
      const n = letterCount(cat, c.ref);
      const target = Math.max(3, Math.min(8, Math.floor(n / 4)));
      return genericRound(
        "multi",
        { c, modeLabel: `${cat.icon} ${cat.label} · ${c.ref}`, prompt: `${cat.prompt.replace(/^Name an? /, "Name ")}s starting with “${c.ref}” — get ${target}!`, timeLimitSec: ctx.timeLimitSec ?? 45 },
        { answerLabel: `${target} valid answers`, data: { categoryId: cat.id, letter: c.ref } },
        { input: { target, letter: c.ref, placeholder: `${c.ref}…` } },
      );
    },
  };
}

export const categoryBattleGame: GameDefinition = {
  slug: BATTLE_SLUG,
  name: "Category Battle",
  short: "A category and a letter. Name as many valid answers as you can before time runs out.",
  icon: "🔤",
  accent: ["#f97316", "#eab308"],
  group: "words",
  rules: ["You get a category and a starting letter.", "Type answers one at a time — each valid, new answer counts.", "Hit the target to score full points; partial credit otherwise. Typos and aliases are recognised."],
  modes: BATTLE_CATS.map(battleMode).filter((m) => m.candidates().length > 0),
  rounds: 6,
  timeLimitSec: 45,
  multiplayer: true,
  scoring: { speedBonus: 30 },
};

/** Closed sets where every valid answer is in the data — so nothing correct is ever rejected. */
interface ClosedSet {
  key: string;
  prompt: string;
  topic: string;
  difficulty: number;
  accept: { name: string; aliases: string[] }[];
}

function closedSets(): ClosedSet[] {
  const out: ClosedSet[] = [];
  const bySub = new Map<string, Country[]>();
  for (const c of SOVEREIGN) bySub.set(c.subregion, [...(bySub.get(c.subregion) ?? []), c]);
  for (const [sub, cs] of bySub) {
    if (!sub || cs.length < 7) continue;
    out.push({ key: `sub:${compact(sub)}`, prompt: `Name 5 countries in ${sub}`, topic: "geography/regions", difficulty: cs.length > 12 ? 2 : 3, accept: cs.map((c) => ({ name: c.name, aliases: c.aliases })) });
    const caps = cs.filter((c) => c.capital.length);
    if (caps.length >= 7) out.push({ key: `cap:${compact(sub)}`, prompt: `Name 5 capital cities in ${sub}`, topic: "geography/capitals", difficulty: 4, accept: caps.map((c) => ({ name: c.capital[0], aliases: c.capital.slice(1) })) });
  }
  for (const c of SOVEREIGN) {
    if (c.borders.length >= 7) {
      const nb = c.borders.map((b) => COUNTRIES.find((x) => x.iso3 === b)).filter((x): x is Country => !!x);
      out.push({ key: `border:${c.iso2}`, prompt: `Name 5 countries that border ${c.name}`, topic: "geography/borders", difficulty: c.fame <= 1 ? 3 : 4, accept: nb.map((x) => ({ name: x.name, aliases: x.aliases })) });
    }
  }
  const winners = [...new Set(WORLD_CUPS.map((w) => w.winner))];
  out.push({ key: "wc-winners", prompt: "Name 5 countries that have won the men's World Cup", topic: "football/worldcup", difficulty: 2, accept: winners.map((w) => ({ name: w, aliases: COUNTRIES.find((c) => c.name === w)?.aliases ?? [] })) });
  const uclClubs = [...new Set(UCL_WINNERS.map((w) => w.winner))];
  out.push({ key: "ucl-winners", prompt: `Name 5 clubs that won the Champions League between ${UCL_WINNERS[0].year} and ${UCL_WINNERS[UCL_WINNERS.length - 1].year}`, topic: "football/ucl", difficulty: 3, accept: uclClubs.map((w) => ({ name: w, aliases: CLUBS.find((c) => c.name === w)?.aliases ?? [] })) });
  for (const cat of CATEGORIES.filter((x) => ["usstates", "elements"].includes(x.id))) {
    for (const l of viableLetters(cat, 6)) out.push({ key: `${cat.id}:${l}`, prompt: `Name 5 ${cat.label.toLowerCase()} starting with “${l}”`, topic: `words/${cat.id}`, difficulty: 3, accept: cat.entries.filter((e) => firstLetter(e.name) === l).map((e) => ({ name: e.name, aliases: e.aliases })) });
  }
  return out.filter((s) => s.accept.length >= 6);
}

let closedCache: ClosedSet[] | null = null;
const CLOSED = () => (closedCache ??= closedSets());

const NAME5_SLUG = "name-five";

const nameFiveClosed: ModeDefinition = {
  id: "closed",
  kinds: ["multi"],
  label: "Complete lists",
  description: "Regions, borders, World Cup winners — every right answer counts.",
  candidates: () => CLOSED().map((s) => ({ key: `name5:${s.key}`, subject: `name5:${s.key}`, topic: s.topic, difficulty: s.difficulty, mode: "closed", gameSlug: NAME5_SLUG, ref: s.key })),
  build(c, ctx) {
    const s = CLOSED().find((x) => x.key === c.ref)!;
    return genericRound("multi", { c, modeLabel: "Name five", prompt: s.prompt, timeLimitSec: ctx.timeLimitSec ?? 35 }, { answerLabel: `Any 5 of ${s.accept.length}`, data: { accept: s.accept } }, { input: { target: 5, placeholder: "Type one at a time…" } });
  },
};

const nameFiveCategory: ModeDefinition = {
  id: "category",
  kinds: ["multi"],
  label: "Categories",
  description: "Name five from a big category.",
  candidates: () =>
    CATEGORIES.filter((cat) => !["famous", "cities"].includes(cat.id)).map((cat) => ({ key: `name5:cat:${cat.id}`, subject: `name5:cat:${cat.id}`, topic: `words/${cat.id}`, difficulty: 1, mode: "category", gameSlug: NAME5_SLUG, ref: cat.id })),
  build(c, ctx) {
    const cat = CATEGORY_BY_ID.get(c.ref)!;
    return genericRound("multi", { c, modeLabel: `${cat.icon} ${cat.label}`, prompt: `${cat.prompt.replace(/^Name an? /, "Name 5 ")}s`, timeLimitSec: ctx.timeLimitSec ?? 25 }, { answerLabel: "Any 5 valid answers", data: { categoryId: cat.id } }, { input: { target: 5, placeholder: "Type one at a time…" } });
  },
};

export const nameFiveGame: GameDefinition = {
  slug: NAME5_SLUG,
  name: "Name Five",
  short: "Five answers, one topic, against the clock.",
  icon: "🖐️",
  accent: ["#06b6d4", "#3b82f6"],
  group: "trivia",
  rules: ["Name five valid answers before the timer runs out.", "Each answer counts once; aliases and small typos are accepted.", "Finishing quickly earns a speed bonus."],
  modes: [nameFiveClosed, nameFiveCategory],
  rounds: 8,
  timeLimitSec: 30,
  multiplayer: true,
};

// ───────────────────────── Higher or Lower ─────────────────────────

const HL_SLUG = "higher-lower";

interface Comparator<T> {
  id: string;
  label: string;
  topic: string;
  pool: () => T[];
  value: (t: T) => number;
  name: (t: T) => string;
  question: string; // "Which country is bigger?"
  more: boolean; // true = pick the larger value
  fmt: (t: T) => string;
  minGap: (a: number, b: number) => boolean;
}

function hlMode<T>(cmp: Comparator<T>, count = 160): ModeDefinition {
  return {
    id: cmp.id,
    kinds: ["choice"],
    label: cmp.label,
    description: cmp.question,
    candidates: () => indexCands(HL_SLUG, cmp.id, count, cmp.topic, [1, 2, 3, 4], "hl"),
    build(c, ctx) {
      const pool = cmp.pool();
      let a: T, b: T;
      let guard = 0;
      // Harder rounds compare closer values.
      do {
        [a, b] = sample(ctx.rng, pool, 2);
        const va = cmp.value(a);
        const vb = cmp.value(b);
        const ratio = Math.max(va, vb) / Math.max(1e-9, Math.min(va, vb));
        const closeEnough = c.difficulty >= 3 ? ratio < 2.5 : ratio > 1.4;
        if (va !== vb && cmp.minGap(va, vb) && (closeEnough || guard > 60)) break;
      } while (guard++ < 120);
      const winner = cmp.more === cmp.value(a) > cmp.value(b) ? a : b;
      const loser = winner === a ? b : a;
      const { options, correctId } = makeOptions(ctx.rng, { label: cmp.name(winner) }, [{ label: cmp.name(loser) }]);
      return genericRound(
        "choice",
        { c, modeLabel: cmp.label, prompt: cmp.question, timeLimitSec: ctx.timeLimitSec ?? 10, explanation: `${cmp.name(a)}: ${cmp.fmt(a)} · ${cmp.name(b)}: ${cmp.fmt(b)}`, source: cmp.topic.startsWith("geo") ? COUNTRY_SRC : MOVIE_SRC },
        { answerLabel: cmp.name(winner), correctOptionId: correctId },
        { options },
      );
    },
  };
}

const famousCountries = () => SOVEREIGN.filter((c) => c.fame <= 3);

export const higherLowerGame: GameDefinition = {
  slug: HL_SLUG,
  name: "Higher or Lower",
  short: "Two things, one number. Which is bigger, older or earlier? Build a streak.",
  icon: "↕️",
  accent: ["#14b8a6", "#22c55e"],
  group: "trivia",
  rules: ["Pick the one with the higher (or earlier) value.", "Rounds are fast — streaks multiply your score.", "Harder rounds compare closer values."],
  modes: [
    hlMode<Country>({ id: "area", label: "Bigger country", topic: "geography/area", pool: famousCountries, value: (c) => c.areaKm2, name: (c) => `${c.flagEmoji} ${c.name}`, question: "Which country has the larger land area?", more: true, fmt: (c) => `${Math.round(c.areaKm2).toLocaleString("en")} km²`, minGap: (a, b) => Math.abs(a - b) / Math.max(a, b) > 0.05 }),
    hlMode<Country>({ id: "borders", label: "More neighbours", topic: "geography/borders", pool: () => famousCountries().filter((c) => c.borders.length > 0), value: (c) => c.borders.length, name: (c) => `${c.flagEmoji} ${c.name}`, question: "Which country borders more countries by land?", more: true, fmt: (c) => `${c.borders.length} land neighbours`, minGap: (a, b) => a !== b }),
    hlMode<Movie>({ id: "movieyear", label: "Older film", topic: "movies/years", pool: () => MOVIES, value: (m) => m.year, name: (m) => m.title, question: "Which film came out first?", more: false, fmt: (m) => String(m.year), minGap: (a, b) => a !== b }),
    hlMode<Celebrity>({ id: "born", label: "Born first", topic: "celebs/born", pool: () => CELEBRITIES, value: (p) => p.born, name: (p) => p.name, question: "Who was born first?", more: false, fmt: (p) => `born ${p.born}`, minGap: (a, b) => a !== b }),
    hlMode({ id: "founded", label: "Older club", topic: "football/clubs", pool: () => CLUBS, value: (c) => c.founded, name: (c) => c.name, question: "Which club was founded first?", more: false, fmt: (c) => `founded ${c.founded}`, minGap: (a, b) => a !== b }),
    hlMode<Footballer>({ id: "playerborn", label: "Older player", topic: "football/born", pool: () => FOOTBALLERS, value: (p) => p.born, name: (p) => p.name, question: "Which footballer was born first?", more: false, fmt: (p) => `born ${p.born}`, minGap: (a, b) => a !== b }),
  ],
  rounds: 15,
  timeLimitSec: 10,
  multiplayer: true,
  scoring: { streakStep: 0.12, streakCap: 1 },
};

// ───────────────────────── Guess the Emoji / Who Am I (built from other games) ─────────────────────────

function borrow(slug: string, game: GameDefinition, modeId: string, overrides: { label?: string } = {}): ModeDefinition {
  const m = game.modes.find((x) => x.id === modeId)!;
  return {
    id: `${game.slug}.${m.id}`,
    kinds: m.kinds,
    label: overrides.label ?? `${game.icon} ${m.label}`,
    description: m.description,
    unavailableReason: m.unavailableReason,
    // Same content keys as the source game → seeing it here counts as seen there too.
    candidates: () => m.candidates().map((c) => ({ ...c, gameSlug: slug, mode: `${game.slug}.${m.id}` })),
    async build(c, ctx) {
      const r = await m.build({ ...c, gameSlug: game.slug, mode: m.id }, ctx);
      r.gameSlug = slug;
      r.pub.gameSlug = slug;
      return r;
    },
  };
}

const EMOJI_SLUG = "emoji";


export const emojiGame: GameDefinition = {
  slug: EMOJI_SLUG,
  name: "Guess the Emoji",
  short: "Films, songs and famous people told only in emoji.",
  icon: "😜",
  accent: ["#facc15", "#ec4899"],
  group: "party",
  rules: ["Decode the emoji string into a film, a song or a person.", "Some rounds are multiple choice; harder ones ask you to type.", "Speed matters!"],
  get modes() {
    return [borrow(EMOJI_SLUG, moviesGame, "emoji", { label: "🎬 Films" }), { ...borrow(EMOJI_SLUG, songsGame, "emoji", { label: "🎵 Songs" }) }, borrow(EMOJI_SLUG, celebritiesGame, "emoji", { label: "🌟 People" })];
  },
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

const WHO_SLUG = "who-am-i";

function countryClues(c: Country): string[] {
  const out: string[] = [];
  out.push(`I'm a ${c.landlocked ? "landlocked " : ""}country in ${c.subregion || c.region}.`);
  out.push(`My land area is about ${(Math.round(c.areaKm2 / 1000) * 1000).toLocaleString("en")} km².`);
  if (c.languages.length) out.push(`Official language${c.languages.length > 1 ? "s" : ""}: ${c.languages.slice(0, 3).join(", ")}.`);
  if (c.currencies.length) out.push(`My currency: ${c.currencies[0]}.`);
  if (c.borders.length) out.push(`I share land borders with ${c.borders.length} ${c.borders.length === 1 ? "country" : "countries"}.`);
  else out.push("I have no land borders.");
  if (c.capital[0]) out.push(`My capital starts with “${c.capital[0][0]}”.`);
  out.push(`My flag: ${c.flagEmoji}`);
  return out;
}

const whoCountry: ModeDefinition = {
  id: "country",
  kinds: ["clues"],
  label: "🌍 Countries",
  description: "I'm a country — which one?",
  candidates: () => SOVEREIGN.filter((c) => c.fame <= 3).map((c) => ({ key: `who:country:${c.iso2}`, subject: `country:${c.iso2}`, topic: `geography/${c.region}`, difficulty: c.fame + 1, mode: "country", gameSlug: WHO_SLUG, ref: c.iso2 })),
  build(c, ctx) {
    const country = COUNTRIES.find((x) => x.iso2 === c.ref)!;
    return cluesRound({ c, modeLabel: "Who am I? · Country", prompt: "Which country am I?", clues: countryClues(country), accept: country.aliases, answerLabel: country.name, timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `${country.flagEmoji} ${country.name}${country.capital[0] ? ` — capital ${country.capital[0]}` : ""}.`, source: COUNTRY_SRC });
  },
};

const whoManager: ModeDefinition = {
  id: "manager",
  kinds: ["clues"],
  label: "📋 Managers",
  description: "I'm a football manager — who?",
  candidates: () => MANAGERS.map((m) => ({ key: `who:manager:${m.id}`, subject: `manager:${m.id}`, topic: "football/managers", difficulty: m.difficulty + 1, mode: "manager", gameSlug: WHO_SLUG, ref: m.id })),
  build(c, ctx) {
    const m = MANAGERS.find((x) => x.id === c.ref)!;
    const teams = [...new Set(m.teams)];
    const clues = [`I'm a ${m.nationality === "Scotland" ? "Scottish" : m.nationality} football manager.`, `I've managed ${teams.length} different team${teams.length > 1 ? "s" : ""}.`, m.fact, `Teams I've managed include ${teams[teams.length - 1]}.`, `My path: ${m.teams.join(" → ")}.`];
    return cluesRound({ c, modeLabel: "Who am I? · Manager", prompt: "Which manager am I?", suggest: "managers", clues, accept: [m.name, ...(m.aliases ?? [])], answerLabel: m.name, timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `${m.name}: ${m.teams.join(" → ")}.`, source: FB_SRC });
  },
};

export const whoAmIGame: GameDefinition = {
  slug: WHO_SLUG,
  name: "Who Am I?",
  short: "Clues from vague to obvious. The fewer you need, the more you score.",
  icon: "🕵️",
  accent: ["#6366f1", "#a855f7"],
  group: "trivia",
  rules: ["The first clue is vague; each extra clue makes it easier but costs points.", "A wrong guess reveals the next clue. Three wrong guesses and you're out.", "People, footballers, managers and countries."],
  get modes() {
    return [borrow(WHO_SLUG, celebritiesGame, "clues", { label: "🌟 Famous people" }), borrow(WHO_SLUG, footballGame, "legend", { label: "⚽ Footballers" }), whoManager, whoCountry];
  },
  rounds: 8,
  timeLimitSec: 40,
  multiplayer: true,
};

// ───────────────────────── Odd One Out ─────────────────────────

const ODD_SLUG = "odd-one-out";

function oddRound(c: Candidate, ctx: BuildContext, label: string, members: string[], odd: string, link: string, oddWhy: string, source: string): Round {
  const { options, correctId } = makeOptions(ctx.rng, { label: odd }, members.map((m) => ({ label: m })));
  return genericRound("choice", { c, modeLabel: label, prompt: "Which one doesn't belong?", timeLimitSec: ctx.timeLimitSec ?? 15, explanation: `${link} — ${oddWhy}`, source }, { answerLabel: odd, correctOptionId: correctId }, { options });
}

const oddRegion: ModeDefinition = {
  id: "region",
  kinds: ["choice"],
  label: "🌍 Regions",
  description: "Three countries share a region. One doesn't.",
  candidates: () => indexCands(ODD_SLUG, "region", 200, "geography/regions", [1, 2, 3, 4], "odd"),
  build(c, ctx) {
    const pool = SOVEREIGN.filter((x) => !TRANSCONTINENTAL.has(x.iso2) && x.fame <= Math.min(4, c.difficulty + 1));
    const bySub = new Map<string, Country[]>();
    for (const x of pool) bySub.set(x.subregion, [...(bySub.get(x.subregion) ?? []), x]);
    const subs = [...bySub.entries()].filter(([s, l]) => s && l.length >= 3);
    const [sub, list] = pick(ctx.rng, subs);
    const three = sample(ctx.rng, list, 3);
    const oddPool = pool.filter((x) => x.subregion !== sub && (c.difficulty >= 3 ? x.region === three[0].region : true));
    const odd = pick(ctx.rng, oddPool.length ? oddPool : pool.filter((x) => x.subregion !== sub));
    return oddRound(c, ctx, "Odd one out · Regions", three.map((x) => x.name), odd.name, `${three.map((x) => x.name).join(", ")} are in ${sub}`, `${odd.name} is in ${odd.subregion}.`, COUNTRY_SRC);
  },
};

const DIRECTORS = (() => {
  const m = new Map<string, Movie[]>();
  for (const mv of MOVIES) m.set(mv.director, [...(m.get(mv.director) ?? []), mv]);
  return [...m.entries()].filter(([, l]) => l.length >= 3);
})();

const oddDirector: ModeDefinition = {
  id: "director",
  kinds: ["choice"],
  label: "🎬 Directors",
  description: "Three films share a director.",
  candidates: () => indexCands(ODD_SLUG, "director", 150, "movies/directors", [2, 3, 3, 4], "odd"),
  build(c, ctx) {
    const [director, films] = pick(ctx.rng, DIRECTORS);
    const three = sample(ctx.rng, films, 3);
    const odd = pick(ctx.rng, MOVIES.filter((m) => m.director !== director && m.genres.some((g) => three.some((t) => t.genres.includes(g)))));
    return oddRound(c, ctx, "Odd one out · Directors", three.map((m) => m.title), odd.title, `${three.map((m) => m.title).join(", ")} were directed by ${director}`, `${odd.title} was directed by ${odd.director}.`, MOVIE_SRC);
  },
};

const oddNationality: ModeDefinition = {
  id: "nationality",
  kinds: ["choice"],
  label: "⚽ Nationalities",
  description: "Three footballers share a national team.",
  candidates: () => indexCands(ODD_SLUG, "nationality", 150, "football/nations", [2, 3, 3, 4], "odd"),
  build(c, ctx) {
    const by = new Map<string, Footballer[]>();
    for (const p of FOOTBALLERS) by.set(p.nationality, [...(by.get(p.nationality) ?? []), p]);
    const [nat, players] = pick(ctx.rng, [...by.entries()].filter(([, l]) => l.length >= 3));
    const three = sample(ctx.rng, players, 3);
    const odd = pick(ctx.rng, FOOTBALLERS.filter((p) => p.nationality !== nat));
    return oddRound(c, ctx, "Odd one out · Football", three.map((p) => p.name), odd.name, `${three.map((p) => p.name).join(", ")} play(ed) for ${nat}`, `${odd.name} represents ${odd.nationality}.`, FB_SRC);
  },
};

const ARTISTS = (() => {
  const m = new Map<string, Song[]>();
  for (const s of SONGS) m.set(s.artist, [...(m.get(s.artist) ?? []), s]);
  return [...m.entries()].filter(([, l]) => l.length >= 3);
})();

const oddCategory: ModeDefinition = {
  id: "category",
  kinds: ["choice"],
  label: "🧩 Categories",
  description: "Three belong to one category, one sneaks in from another.",
  candidates: () => indexCands(ODD_SLUG, "category", 200, "words/categories", [1, 2, 2, 3], "odd"),
  build(c, ctx) {
    const usable = CATEGORIES.filter((x) => ["animals", "foods", "carbrands", "sports", "elements", "jobs", "languages", "usstates", "videogames", "capitals", "countries"].includes(x.id));
    for (let i = 0; i < 30; i++) {
      const [a, b] = sample(ctx.rng, usable, 2);
      const three = sample(ctx.rng, singleNameEntries(a, 2), 3);
      const odd = pick(ctx.rng, singleNameEntries(b, 2));
      // Reject if any item could belong to both categories (e.g. "Georgia", "Turkey", "Jordan").
      const ambiguous = [...three, odd].some((e) => resolveAnswer(a, e.name) && resolveAnswer(b, e.name)) || resolveAnswer(a, odd.name);
      if (ambiguous) continue;
      return oddRound(c, ctx, "Odd one out · Categories", three.map((e) => e.name), odd.name, `${three.map((e) => e.name).join(", ")} are all ${a.label.toLowerCase()}`, `${odd.name} is from ${b.label.toLowerCase()}.`, "PartyVerse category lists.");
    }
    throw new Error("no-unambiguous-set");
  },
};

const oddArtist: ModeDefinition = {
  id: "artist",
  kinds: ["choice"],
  label: "🎵 Artists",
  description: "Three songs by one artist.",
  unavailableReason: () => (ARTISTS.length ? null : "Not enough artists with 3+ songs in the dataset."),
  candidates: () => (ARTISTS.length ? indexCands(ODD_SLUG, "artist", 80, "music/artists", [2, 3, 3, 4], "odd") : []),
  build(c, ctx) {
    const [artist, songs] = pick(ctx.rng, ARTISTS);
    const three = sample(ctx.rng, songs, 3);
    const odd = pick(ctx.rng, SONGS.filter((s) => s.artist !== artist && !songArtistNames(s).includes(artist)));
    return oddRound(c, ctx, "Odd one out · Music", three.map((s) => s.title), odd.title, `${three.map((s) => s.title).join(", ")} are by ${artist}`, `${odd.title} is by ${odd.artist}.`, SONG_SRC);
  },
};

export const oddOneOutGame: GameDefinition = {
  slug: ODD_SLUG,
  name: "Odd One Out",
  short: "Four items, three share a secret link. Spot the impostor.",
  icon: "🧐",
  accent: ["#f43f5e", "#a855f7"],
  group: "trivia",
  rules: ["Three of the four options share something.", "Pick the one that doesn't fit.", "The reveal tells you the hidden link."],
  modes: [oddRegion, oddDirector, oddNationality, oddCategory, oddArtist],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

// ───────────────────────── Guess the Year ─────────────────────────

const YEAR_SLUG = "guess-the-year";

const yearWorldCup: ModeDefinition = {
  id: "worldcup",
  kinds: ["number"],
  label: "⚽ World Cups",
  description: "When was this World Cup?",
  candidates: () => WORLD_CUPS.map((w) => ({ key: `year:wc:${w.year}`, subject: `wc:${w.year}`, topic: "football/worldcup", difficulty: w.year > 1990 ? 2 : 4, mode: "worldcup", gameSlug: YEAR_SLUG, ref: String(w.year) })),
  build(c, ctx) {
    const w = WORLD_CUPS.find((x) => String(x.year) === c.ref)!;
    return numberRound({ c, modeLabel: "Guess the year · World Cup", prompt: `${w.winner} beat ${w.runnerUp} in the World Cup final hosted by ${w.host}. What year?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: w.year, min: 1930, max: 2026, step: 1, tolerance: 8, explanation: `${w.year} — ${w.winner} won in ${w.host}.`, source: FB_SRC });
  },
};

const yearUcl: ModeDefinition = {
  id: "ucl",
  kinds: ["number"],
  label: "🏆 Champions League",
  description: "When was this final?",
  // Finals between the same two clubs more than once would have two right answers — skipped.
  candidates: () => UCL_WINNERS.filter((w) => UCL_WINNERS.filter((x) => x.winner === w.winner && x.runnerUp === w.runnerUp).length === 1).map((w) => ({ key: `year:ucl:${w.year}`, subject: `ucl:${w.year}`, topic: "football/ucl", difficulty: 3, mode: "ucl", gameSlug: YEAR_SLUG, ref: String(w.year) })),
  build(c, ctx) {
    const w = UCL_WINNERS.find((x) => String(x.year) === c.ref)!;
    return numberRound({ c, modeLabel: "Guess the year · Champions League", prompt: `${w.winner} beat ${w.runnerUp} in the Champions League final. In what year was that final played?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: w.year, min: 1990, max: 2026, tolerance: 5, explanation: `The ${w.year - 1}/${String(w.year).slice(2)} final, played in ${w.year}.`, source: FB_SRC });
  },
};

const yearClub: ModeDefinition = {
  id: "founded",
  kinds: ["number"],
  label: "🏟️ Clubs founded",
  description: "When was the club founded?",
  candidates: () => CLUBS.map((cl) => ({ key: `year:club:${cl.id}`, subject: `club:${cl.id}`, topic: "football/clubs", difficulty: cl.difficulty + 2, mode: "founded", gameSlug: YEAR_SLUG, ref: cl.id })),
  build(c, ctx) {
    const cl = CLUBS.find((x) => x.id === c.ref)!;
    return numberRound({ c, modeLabel: "Guess the year · Clubs", prompt: `In what year was ${cl.name} founded?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: cl.founded, min: 1850, max: 2000, tolerance: 12, explanation: `${cl.name} was founded in ${cl.founded}.`, source: FB_SRC });
  },
};

const yearBorn: ModeDefinition = {
  id: "born",
  kinds: ["number"],
  label: "🎂 Birth years",
  description: "When was this famous person born?",
  candidates: () => CELEBRITIES.map((p) => ({ key: `year:born:${p.id}`, subject: `celeb:${p.id}`, topic: "celebs/born", difficulty: p.difficulty + 1, mode: "born", gameSlug: YEAR_SLUG, ref: p.id })),
  build(c, ctx) {
    const p = CELEBRITIES.find((x) => x.id === c.ref)!;
    return numberRound({ c, modeLabel: "Guess the year · Birthdays", prompt: `In what year was ${p.name} born?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: p.born, min: 1900, max: 2010, tolerance: 6, explanation: `${p.name} was born in ${p.born}.`, source: CELEB_SRC });
  },
};

export const guessYearGame: GameDefinition = {
  slug: YEAR_SLUG,
  name: "Guess the Year",
  short: "Films, songs, finals and birthdays — how close can you get to the year?",
  icon: "📆",
  accent: ["#0ea5e9", "#f59e0b"],
  group: "trivia",
  rules: ["Slide or type a year.", "Exact answers score full points; close guesses score partial points.", "The tolerance depends on how obscure the event is."],
  get modes() {
    return [borrow(YEAR_SLUG, moviesGame, "year", { label: "🎬 Films" }), borrow(YEAR_SLUG, songsGame, "year", { label: "🎵 Songs" }), yearWorldCup, yearUcl, yearClub, yearBorn];
  },
  rounds: 10,
  timeLimitSec: 20,
  multiplayer: true,
};

// ───────────────────────── Connections ─────────────────────────

const CONN_SLUG = "connections";

interface GroupSource {
  label: string;
  level: number;
  items: string[];
  has: (name: string) => boolean;
}

function groupSources(rng: Rng): GroupSource[] {
  const out: GroupSource[] = [];
  for (const id of ["animals", "foods", "carbrands", "sports", "elements", "jobs", "languages", "usstates", "videogames", "fruitveg"]) {
    const cat = CATEGORY_BY_ID.get(id)!;
    const items = cat.entries.filter((e) => e.tier <= 2 && e.name.length <= 14).map((e) => e.name);
    out.push({ label: cat.label, level: 0, items, has: (n) => !!resolveAnswer(cat, n) && compact(resolveAnswer(cat, n)!.name) === compact(n) });
  }
  const bySub = new Map<string, Country[]>();
  for (const c of SOVEREIGN.filter((x) => x.fame <= 3 && !TRANSCONTINENTAL.has(x.iso2))) bySub.set(c.subregion, [...(bySub.get(c.subregion) ?? []), c]);
  for (const [sub, cs] of bySub) if (sub && cs.length >= 5) out.push({ label: `Countries in ${sub}`, level: 1, items: cs.map((c) => c.name), has: (n) => cs.some((c) => compact(c.name) === compact(n)) });
  for (const [director, films] of DIRECTORS) if (films.length >= 4) out.push({ label: `Directed by ${director}`, level: 2, items: films.map((m) => m.title), has: (n) => films.some((m) => compact(m.title) === compact(n)) });
  const byNat = new Map<string, Footballer[]>();
  for (const p of FOOTBALLERS) byNat.set(p.nationality, [...(byNat.get(p.nationality) ?? []), p]);
  for (const [nat, ps] of byNat) if (ps.length >= 4) out.push({ label: `${nat} internationals`, level: 3, items: ps.map((p) => p.name), has: (n) => ps.some((p) => compact(p.name) === compact(n)) });
  const capitals = SOVEREIGN.filter((c) => c.fame <= 2 && c.capital[0]);
  out.push({ label: "Capital cities", level: 1, items: capitals.map((c) => c.capital[0]), has: (n) => capitals.some((c) => compact(c.capital[0]) === compact(n)) });
  return shuffle(rng, out);
}

const connClassic: ModeDefinition = {
  id: "classic",
  kinds: ["groups"],
  label: "Four by four",
  description: "Sixteen tiles, four hidden groups.",
  candidates: () => indexCands(CONN_SLUG, "classic", 400, "mixed/connections", [2, 3, 3, 4], "conn"),
  build(c, ctx) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const sources = groupSources(ctx.rng);
      // Prefer a spread of levels; harder puzzles take more obscure groups.
      const chosen: GroupSource[] = [];
      for (const s of sources) {
        if (chosen.length === 4) break;
        if (chosen.some((x) => x.level === s.level) && chosen.length < 3 && ctx.rng() < 0.7) continue;
        if (chosen.some((x) => x.label === s.label)) continue;
        chosen.push(s);
      }
      if (chosen.length < 4) continue;
      const groups = chosen.map((g) => ({ g, picks: sample(ctx.rng, g.items, 4) }));
      const all = groups.flatMap((x) => x.picks);
      if (new Set(all.map(compact)).size !== 16) continue;
      // Every tile must belong to exactly one group.
      const ok = groups.every(({ g, picks }) => picks.every((item) => chosen.filter((other) => other !== g).every((other) => !other.has(item))));
      if (!ok) continue;
      const tiles = all.map((label) => ({ label, id: Math.floor(ctx.rng() * 36 ** 6).toString(36).padStart(6, "0") + label.length }));
      const idOf = new Map(tiles.map((t) => [t.label, t.id]));
      const secretGroups = groups.map(({ g, picks }, i) => ({ label: g.label, ids: picks.map((p) => idOf.get(p)!), level: [...groups].sort((a, b) => a.g.level - b.g.level).findIndex((x) => x.g === g) ?? i }));
      return genericRound(
        "groups",
        { c, modeLabel: "Connections", prompt: "Find four groups of four.", timeLimitSec: ctx.timeLimitSec ?? 150, explanation: groups.map(({ g, picks }) => `${g.label}: ${picks.join(", ")}`).join(" · "), source: "Built from PartyVerse datasets; every tile is checked against all four groups." },
        { answerLabel: groups.map((x) => x.g.label).join(" · "), groups: secretGroups },
        { options: shuffle(ctx.rng, tiles).map((t) => ({ id: t.id, label: t.label })) },
      );
    }
    throw new Error("no-valid-puzzle");
  },
};

export const connectionsGame: GameDefinition = {
  slug: CONN_SLUG,
  name: "Connections",
  short: "Sixteen tiles hide four groups of four. Find them before you run out of mistakes.",
  icon: "🧩",
  accent: ["#eab308", "#22c55e"],
  group: "words",
  rules: ["Select four tiles you think belong together and submit.", "You can make three mistakes — the fourth ends the puzzle.", "“One away” means three of your four are right."],
  modes: [connClassic],
  rounds: 3,
  timeLimitSec: 150,
  multiplayer: true,
  scoring: { speedBonus: 40 },
};

// ───────────────────────── Memory Challenge ─────────────────────────

const MEM_SLUG = "memory";
const MEM_EMOJI = "🍎 🍌 🍇 🍉 🍒 🥝 🍍 🥥 🥕 🌽 🍄 🌶️ 🐶 🐱 🦊 🐻 🐼 🐸 🐵 🐧 🦉 🐙 🦋 🐢 ⚽ 🏀 🎾 🎸 🎺 🎲 🚗 🚀 ✈️ 🚲 ⛵ 🏰 🌋 🌈 ⭐ 🌙 ☀️ ❄️ 🔥 💎 🔑 📚 ✏️ ⏰ 🎁 🎈".split(" ");

function memoryRound(c: Candidate, ctx: BuildContext, label: string, items: string[], asEmoji: boolean, studySeconds: number): Round {
  const n = items.length;
  const shown = items;
  const pool = asEmoji ? MEM_EMOJI : [];
  const qType = randInt(ctx.rng, 0, asEmoji ? 2 : 1);
  let question: string;
  let correct: string;
  let distractors: string[];
  if (qType === 0 && pool.length) {
    question = "Which of these was NOT shown?";
    correct = pick(ctx.rng, pool.filter((x) => !shown.includes(x)));
    distractors = sample(ctx.rng, shown, 3);
  } else if (qType === 1) {
    const pos = randInt(ctx.rng, 1, n);
    question = `What was item number ${pos}?`;
    correct = shown[pos - 1];
    distractors = sample(ctx.rng, shown.filter((x) => x !== correct), 3);
  } else {
    const i = randInt(ctx.rng, 0, n - 2);
    question = `What came right after ${shown[i]}?`;
    correct = shown[i + 1];
    distractors = sample(ctx.rng, shown.filter((x) => x !== correct && x !== shown[i]), 3);
  }
  const { options, correctId } = makeOptions(ctx.rng, { label: correct }, distractors.map((d) => ({ label: d })));
  const study: MediaRef[] = asEmoji ? shown.map((e) => ({ type: "emoji", value: e })) : [{ type: "words", items: shown.map((w, i) => `${i + 1}. ${w}`) }];
  return genericRound("memory", { c, modeLabel: label, prompt: "Memorise this — in order!", timeLimitSec: ctx.timeLimitSec ?? studySeconds + 12 }, { answerLabel: correct, correctOptionId: correctId, data: { question, options }, explanation: `The sequence was: ${shown.join(" · ")}` }, { extra: { study, studySeconds } });
}

export const memoryGame: GameDefinition = {
  slug: MEM_SLUG,
  name: "Memory Challenge",
  short: "Study a sequence for a few seconds, then answer a question about it.",
  icon: "🧠",
  accent: ["#8b5cf6", "#06b6d4"],
  group: "party",
  rules: ["A sequence appears for a few seconds — memorise it.", "Then answer: what was missing, what came next, what was at position N.", "Your answer speed counts from when the question appears."],
  get modes(): ModeDefinition[] {
    return [
      {
        id: "emoji",
        kinds: ["memory"],
        label: "Emoji sequence",
        description: "Remember a row of emoji.",
        candidates: () => indexCands(MEM_SLUG, "emoji", 300, "memory/emoji", [1, 2, 3, 4, 5], "mem"),
        build: (c, ctx) => memoryRound(c, ctx, "Emoji memory", sample(ctx.rng, MEM_EMOJI, 4 + c.difficulty), true, 3 + c.difficulty),
      },
      {
        id: "words",
        kinds: ["memory"],
        label: "Word list",
        description: "Remember a list of words.",
        candidates: () => indexCands(MEM_SLUG, "words", 300, "memory/words", [1, 2, 3, 4, 5], "mem"),
        build: (c, ctx) => {
          const cat = pick(ctx.rng, CATEGORIES.filter((x) => ["animals", "foods", "sports", "jobs", "fruitveg", "countries"].includes(x.id)));
          const words = sample(ctx.rng, cat.entries.filter((e) => e.tier <= 2 && e.name.length <= 12).map((e) => e.name), 4 + c.difficulty);
          return memoryRound(c, ctx, "Word memory", words, false, 4 + c.difficulty);
        },
      },
      borrow(MEM_SLUG, flagsGame, "memory", { label: "🚩 Flag grid" }),
    ];
  },
  rounds: 8,
  timeLimitSec: 20,
  multiplayer: true,
};

// ───────────────────────── Blurred Image ─────────────────────────

const BLUR_SLUG = "blurred";

function blurMode(id: string, label: string, description: string, render: (step: number) => { blur?: number; pixelate?: number; grayscale?: boolean }, steps: number): ModeDefinition {
  return {
    id,
    kinds: ["reveal"],
    label,
    description,
    candidates: () => FLAG_COUNTRIES.filter((c) => c.fame <= 3).map((c) => ({ key: `blur:${id}:${c.iso2}`, subject: `country:${c.iso2}`, topic: `geography/${c.region}`, difficulty: Math.min(5, c.fame + 1), mode: id, gameSlug: BLUR_SLUG, ref: c.iso2 })),
    build(c, ctx) {
      const country = COUNTRIES.find((x) => x.iso2 === c.ref)!;
      const stages: MediaRef[] = Array.from({ length: steps }, (_, i) => ({ type: "image", url: ctx.media.flag(country.iso2, { width: 480, ...render(i) }), alt: "A blurred image", frame: "flag" }));
      const distractors = pickDistinct(ctx.rng, SOVEREIGN.filter((x) => x.iso2 !== country.iso2 && x.region === country.region), 3, (x) => x.iso2);
      if (c.difficulty <= 2 || ctx.preferChoice)
        return revealRound({ c, rng: ctx.rng, modeLabel: label, prompt: "What's in the picture? Reveal more if you need to.", stages, answerLabel: country.name, correct: { label: country.name }, distractors: distractors.map((d) => ({ label: d.name })), timeLimitSec: ctx.timeLimitSec ?? 30, explanation: `${country.flagEmoji} The flag of ${country.name}.`, source: "Flags: country-flag-icons (MIT)." });
      return revealRound({ c, modeLabel: label, prompt: "Whose flag is this? Reveal more if you need to.", stages, answerLabel: country.name, accept: country.aliases, timeLimitSec: ctx.timeLimitSec ?? 35, explanation: `${country.flagEmoji} The flag of ${country.name}.`, source: "Flags: country-flag-icons (MIT)." });
    },
  };
}

export const blurredGame: GameDefinition = {
  slug: BLUR_SLUG,
  name: "Blurred Image",
  short: "A heavily blurred or pixelated image sharpens step by step. Guess early for more points.",
  icon: "🔍",
  accent: ["#64748b", "#06b6d4"],
  group: "visual",
  rules: ["The image starts unrecognisable. Each reveal makes it clearer but costs points.", "Images are rendered on the server, so the sharp version never reaches your browser early.", "Image source: national flags (MIT licensed). More licensed sources can be plugged in."],
  modes: [
    blurMode("blur", "Blur", "Heavy blur that slowly clears.", (i) => ({ blur: [40, 24, 13, 6, 0][i] || undefined }), 5),
    blurMode("pixels", "Pixels", "Starts as a handful of pixels.", (i) => (i < 4 ? { pixelate: [3, 6, 12, 24][i] } : {}), 5),
    blurMode("mono", "Grey & blurred", "No colour until the very end.", (i) => (i < 4 ? { grayscale: true, blur: [30, 16, 8, 3][i] } : {}), 5),
  ],
  rounds: 8,
  timeLimitSec: 30,
  multiplayer: true,
};

// ───────────────────────── Two Truths and a Lie ─────────────────────────

const TTL_SLUG = "two-truths";

function ttlRound(c: Candidate, ctx: BuildContext, subject: string, truths: string[], lie: string, why: string, source: string): Round {
  const t = sample(ctx.rng, truths, 2);
  const { options, correctId } = makeOptions(ctx.rng, { label: lie }, t.map((x) => ({ label: x })));
  return genericRound("choice", { c, modeLabel: "Two truths and a lie", prompt: `${subject}: two of these are true. Which is the LIE?`, timeLimitSec: ctx.timeLimitSec ?? 20, explanation: why, source }, { answerLabel: lie, correctOptionId: correctId }, { options });
}

const ttlCountry: ModeDefinition = {
  id: "country",
  kinds: ["choice"],
  label: "🌍 Countries",
  description: "Facts about a country.",
  candidates: () => SOVEREIGN.filter((c) => c.fame <= 3 && c.capital[0] && c.currencies[0]).map((c) => ({ key: `ttl:country:${c.iso2}`, subject: `country:${c.iso2}`, topic: `geography/${c.region}`, difficulty: c.fame + 1, mode: "country", gameSlug: TTL_SLUG, ref: c.iso2 })),
  build(c, ctx) {
    const k = COUNTRIES.find((x) => x.iso2 === c.ref)!;
    const others = SOVEREIGN.filter((x) => x.iso2 !== k.iso2);
    const truths = [`Its capital is ${k.capital[0]}.`, `It uses the ${k.currencies[0]}.`, `It is in ${k.subregion || k.region}.`, k.landlocked ? "It has no coastline." : "It has a coastline.", `It shares land borders with ${k.borders.length} ${k.borders.length === 1 ? "country" : "countries"}.`];
    const lies: { text: string; why: string }[] = [];
    const wrongCap = pick(ctx.rng, others.filter((x) => x.capital[0] && !k.capital.includes(x.capital[0]) && x.region === k.region));
    if (wrongCap) lies.push({ text: `Its capital is ${wrongCap.capital[0]}.`, why: `${k.capital[0]} is the capital; ${wrongCap.capital[0]} is the capital of ${wrongCap.name}.` });
    const wrongCur = others.find((x) => x.currencies[0] && !k.currencies.includes(x.currencies[0]) && x.region === k.region);
    if (wrongCur) lies.push({ text: `It uses the ${wrongCur.currencies[0]}.`, why: `${k.name} uses the ${k.currencies[0]}.` });
    lies.push({ text: k.landlocked ? "It has a coastline." : "It has no coastline.", why: `${k.name} is ${k.landlocked ? "" : "not "}landlocked.` });
    const lie = pick(ctx.rng, lies);
    const usable = truths.filter((t) => (lie.text.includes("capital") ? !t.includes("capital") : lie.text.includes("currency") || lie.text.includes("uses the") ? !t.includes("uses the") : !t.includes("coastline")));
    return ttlRound(c, ctx, `${k.flagEmoji} ${k.name}`, usable, lie.text, lie.why, COUNTRY_SRC);
  },
};

const ttlMovie: ModeDefinition = {
  id: "movie",
  kinds: ["choice"],
  label: "🎬 Films",
  description: "Facts about a film.",
  candidates: () => MOVIES.map((m) => ({ key: `ttl:movie:${m.id}`, subject: `movie:${m.id}`, topic: `movies/${m.genres[0] ?? "film"}`, difficulty: m.difficulty + 1, mode: "movie", gameSlug: TTL_SLUG, ref: m.id })),
  build(c, ctx) {
    const m = MOVIES.find((x) => x.id === c.ref)!;
    const truths = [`It was released in ${m.year}.`, `It was directed by ${m.director}.`, `${m.stars[0]} stars in it.`];
    if (m.stars[1]) truths.push(`${m.stars[1]} appears in it.`);
    const lies: { text: string; why: string; avoid: string }[] = [];
    const wrongDir = pick(ctx.rng, MOVIES.filter((x) => x.director !== m.director));
    lies.push({ text: `It was directed by ${wrongDir.director}.`, why: `${m.title} was directed by ${m.director}.`, avoid: "directed" });
    const shift = (ctx.rng() < 0.5 ? -1 : 1) * randInt(ctx.rng, 4, 11);
    if (m.year + shift <= new Date().getUTCFullYear()) lies.push({ text: `It was released in ${m.year + shift}.`, why: `${m.title} came out in ${m.year}.`, avoid: "released" });
    const wrongStar = pick(ctx.rng, MOVIES.flatMap((x) => x.stars).filter((s) => !m.stars.includes(s)));
    lies.push({ text: `${wrongStar} stars in it.`, why: `${wrongStar} isn't in ${m.title}; it stars ${m.stars.slice(0, 3).join(", ")}.`, avoid: "stars in" });
    const lie = pick(ctx.rng, lies);
    return ttlRound(c, ctx, `🎬 ${m.title}`, truths.filter((t) => !t.includes(lie.avoid)), lie.text, lie.why, MOVIE_SRC);
  },
};

const ttlFootballer: ModeDefinition = {
  id: "footballer",
  kinds: ["choice"],
  label: "⚽ Footballers",
  description: "Facts about a footballer.",
  candidates: () => FOOTBALLERS.filter((p) => new Set(p.clubs).size >= 2).map((p) => ({ key: `ttl:fb:${p.id}`, subject: `player:${p.id}`, topic: "football/players", difficulty: p.difficulty + 1, mode: "footballer", gameSlug: TTL_SLUG, ref: p.id })),
  build(c, ctx) {
    const p = FOOTBALLERS.find((x) => x.id === c.ref)!;
    const clubs = [...new Set(p.clubs)];
    const truths = [`They play(ed) for ${p.nationality}.`, `They are a ${p.position.toLowerCase()}.`, `They were born in the ${decadeOf(p.born)}.`, `They played for ${pick(ctx.rng, clubs)}.`];
    // Lies only use fields that are complete in the data (never club lists, which could be partial).
    const lies = [
      { text: `They play(ed) for ${pick(ctx.rng, [...new Set(FOOTBALLERS.map((x) => x.nationality))].filter((n) => n !== p.nationality))}.`, why: `${p.name} represents ${p.nationality}.`, avoid: "play(ed) for" },
      { text: `They are a ${pick(ctx.rng, ["Goalkeeper", "Defender", "Midfielder", "Forward"].filter((x) => x !== p.position)).toLowerCase()}.`, why: `${p.name} is a ${p.position.toLowerCase()}.`, avoid: "They are a" },
      { text: `They were born in the ${decadeOf(p.born + (ctx.rng() < 0.5 ? -10 : 10))}.`, why: `${p.name} was born in ${p.born}.`, avoid: "born" },
    ];
    const lie = pick(ctx.rng, lies);
    return ttlRound(c, ctx, `⚽ ${p.name}`, truths.filter((t) => !t.startsWith(lie.avoid) && !t.includes(lie.avoid)), lie.text, lie.why, FB_SRC);
  },
};

const ttlCeleb: ModeDefinition = {
  id: "celebrity",
  kinds: ["choice"],
  label: "🌟 Celebrities",
  description: "Facts about a famous person.",
  candidates: () => CELEBRITIES.filter((p) => p.knownFor.length >= 2).map((p) => ({ key: `ttl:celeb:${p.id}`, subject: `celeb:${p.id}`, topic: `celebs/${p.profession.toLowerCase()}`, difficulty: p.difficulty + 1, mode: "celebrity", gameSlug: TTL_SLUG, ref: p.id })),
  build(c, ctx) {
    const p = CELEBRITIES.find((x) => x.id === c.ref)!;
    const truths = [`They were born in ${p.born}.`, `They are from ${p.nationality}.`, ...p.knownFor.slice(0, 3).map((k) => `They are known for ${k}.`)];
    const otherKnown = pick(ctx.rng, CELEBRITIES.filter((x) => x.id !== p.id && x.profession === p.profession).flatMap((x) => x.knownFor).filter((k) => !p.knownFor.includes(k)));
    const lies = [
      { text: `They are known for ${otherKnown}.`, why: `That's ${CELEBRITIES.find((x) => x.knownFor.includes(otherKnown))?.name}.`, avoid: "known for" },
      { text: `They were born in ${p.born + (ctx.rng() < 0.5 ? -1 : 1) * randInt(ctx.rng, 5, 12)}.`, why: `${p.name} was born in ${p.born}.`, avoid: "born" },
      { text: `They are from ${pick(ctx.rng, [...new Set(CELEBRITIES.map((x) => x.nationality))].filter((n) => n !== p.nationality))}.`, why: `${p.name} is from ${p.nationality}.`, avoid: "are from" },
    ];
    const lie = pick(ctx.rng, lies);
    return ttlRound(c, ctx, `🌟 ${p.name}`, truths.filter((t) => !t.includes(lie.avoid)), lie.text, lie.why, CELEB_SRC);
  },
};

export const twoTruthsGame: GameDefinition = {
  slug: TTL_SLUG,
  name: "Two Truths and a Lie",
  short: "Three statements, one is false. Can you spot the lie?",
  icon: "🤥",
  accent: ["#ef4444", "#f59e0b"],
  group: "party",
  rules: ["Read the three statements about the subject.", "Two are true (straight from our data); one is a lie.", "Pick the lie — the reveal explains the truth."],
  modes: [ttlCountry, ttlMovie, ttlFootballer, ttlCeleb],
  rounds: 10,
  timeLimitSec: 20,
  multiplayer: true,
};

export const CLASSIC_GAMES = (): GameDefinition[] => [songsGame, wordChainGame, categoryBattleGame, higherLowerGame, emojiGame, whoAmIGame, oddOneOutGame, guessYearGame, connectionsGame, memoryGame, blurredGame, twoTruthsGame, nameFiveGame];

