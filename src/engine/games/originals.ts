/**
 * PartyVerse originals — ten games with their own mechanics (ranking, distance feedback,
 * wagering, sorting, link-finding, estimation, anagrams, letter reveals, crowd-matching and
 * word building). All facts come from the shared datasets.
 */
import { COUNTRIES, distanceKm, type Country } from "@/content/datasets/countries";
import { MOVIES } from "@/content/datasets/movies";
import { SONGS } from "@/content/datasets/songs";
import { CELEBRITIES } from "@/content/datasets/celebrities";
import { CLUBS, FOOTBALLERS, type Footballer } from "@/content/datasets/football";
import { CATEGORIES, CATEGORY_BY_ID, type Category } from "@/content/categories";
import { dictionaryWords, isDictionaryWord } from "../dictionary";
import { choiceRound, cluesRound, decadeOf, genericRound, makeOptions, numberRound, orderRound, pickDistinct, textRound } from "../build";
import { compact } from "../normalize";
import { pick, randInt, sample, shuffle, type Rng } from "../rng";
import { proxyModes } from "./mix";
import { oddsForDifficulty } from "../chips";
import { SOVEREIGN, TRANSCONTINENTAL } from "./classics";
import type { BuildContext, Candidate, GameDefinition, ModeDefinition, Round } from "../types";

const COUNTRY_SRC = "Country data: mledoze/countries (ODbL).";

function idx(slug: string, mode: string, n: number, topic: string, diffs = [1, 2, 3, 4]): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({ key: `${slug}:${mode}:${i}`, subject: `${slug}:${mode}:${i}`, topic, difficulty: diffs[i % diffs.length], mode, gameSlug: slug, ref: String(i) }));
}

const famous = (maxFame: number) => SOVEREIGN.filter((c) => c.fame <= maxFame);

// ───────────────────────── 1. Rank It ─────────────────────────

const RANK = "rank-it";

function rankMode<T>(id: string, label: string, prompt: string, pool: () => T[], value: (t: T) => number, name: (t: T) => string, fmt: (t: T) => string, ends: [string, string], desc: boolean, topic: string, source: string): ModeDefinition {
  return {
    id,
    kinds: ["order"],
    label,
    description: prompt,
    candidates: () => idx(RANK, id, 200, topic, [2, 3, 3, 4]),
    build(c, ctx) {
      const n = c.difficulty >= 4 ? 5 : 4;
      const chosen: T[] = [];
      for (const t of shuffle(ctx.rng, pool())) {
        const v = value(t);
        if (chosen.some((x) => Math.abs(value(x) - v) / Math.max(1, Math.abs(v)) < 0.04 || value(x) === v)) continue;
        chosen.push(t);
        if (chosen.length === n) break;
      }
      chosen.sort((a, b) => (desc ? value(b) - value(a) : value(a) - value(b)));
      return orderRound({ c, rng: ctx.rng, modeLabel: `Rank it · ${label}`, prompt, timeLimitSec: ctx.timeLimitSec ?? 35, items: chosen.map((t) => ({ label: name(t) })), labels: ends, explanation: chosen.map((t) => `${name(t)} (${fmt(t)})`).join(" → "), source });
    },
  };
}

export const rankItGame: GameDefinition = {
  slug: RANK,
  name: "Rank It",
  short: "Drag four or five things into the right order — by size, age or date.",
  icon: "📊",
  accent: ["#22d3ee", "#a855f7"],
  group: "trivia",
  original: true,
  rules: ["Drag the items (or use the arrows) into the correct order.", "Perfect order scores full points; nearly-right orders earn partial credit.", "Harder rounds have five items."],
  modes: [
    rankMode<Country>("area", "Country size", "Biggest to smallest by land area.", () => famous(3), (c) => c.areaKm2, (c) => `${c.flagEmoji} ${c.name}`, (c) => `${Math.round(c.areaKm2).toLocaleString("en")} km²`, ["Biggest", "Smallest"], true, "geography/area", COUNTRY_SRC),
    rankMode("films", "Film release", "Oldest to newest.", () => MOVIES, (m) => m.year, (m) => m.title, (m) => String(m.year), ["Oldest", "Newest"], false, "movies/years", "Movie facts: public record."),
    rankMode("birth", "Birth year", "Oldest person to youngest.", () => CELEBRITIES, (p) => p.born, (p) => p.name, (p) => `born ${p.born}`, ["Oldest", "Youngest"], false, "celebs/born", "Public record."),
    rankMode("clubs", "Club age", "Oldest club to youngest.", () => CLUBS, (c) => c.founded, (c) => c.name, (c) => `founded ${c.founded}`, ["Oldest", "Newest"], false, "football/clubs", "Football data: public record."),
    rankMode("songs", "Song release", "Oldest hit to newest.", () => SONGS.filter((s) => s.year), (s) => s.year!, (s) => `${s.title} — ${s.artist}`, (s) => String(s.year), ["Oldest", "Newest"], false, "music/years", "Song facts: public record."),
  ],
  rounds: 8,
  timeLimitSec: 35,
  multiplayer: true,
};

// ───────────────────────── 2. Map Mystery ─────────────────────────

const MAP = "map-mystery";
const MAP_CHOICES = SOVEREIGN.map((c) => c.name).sort();

export const mapMysteryGame: GameDefinition = {
  slug: MAP,
  name: "Map Mystery",
  short: "Find the hidden country. Every guess tells you how far away you are and which way to go.",
  icon: "🧭",
  accent: ["#10b981", "#0ea5e9"],
  group: "visual",
  original: true,
  rules: ["Guess any country. You'll see the distance and compass direction to the mystery country.", "Six guesses. Fewer guesses = more points.", "Ending close earns partial credit."],
  modes: [
    {
      id: "classic",
      kinds: ["map"],
      label: "Mystery country",
      description: "Hot-and-cold country hunt.",
      candidates: () => famous(4).map((c) => ({ key: `map:${c.iso2}`, subject: `country:${c.iso2}`, topic: `geography/${c.region}`, difficulty: Math.min(5, c.fame + 1), mode: "classic", gameSlug: MAP, ref: c.iso2 })),
      build(c, ctx) {
        const k = COUNTRIES.find((x) => x.iso2 === c.ref)!;
        const facts = [{ label: "Land area", value: `${(Math.round(k.areaKm2 / 1000) * 1000).toLocaleString("en")} km²` }];
        if (c.difficulty >= 3 && k.languages[0]) facts.push({ label: "A language spoken", value: k.languages[0] });
        if (c.difficulty >= 4) facts.push({ label: "Coastline", value: k.landlocked ? "None (landlocked)" : "Yes" });
        return genericRound(
          "map",
          { c, modeLabel: "Map Mystery", prompt: "Which country is hiding? Distances are measured between country centres.", media: [{ type: "facts", items: facts }], timeLimitSec: ctx.timeLimitSec ?? 90, explanation: `${k.flagEmoji} ${k.name}${k.capital[0] ? ` — capital ${k.capital[0]}` : ""}, in ${k.subregion}.`, source: COUNTRY_SRC },
          { answerLabel: k.name, data: { iso2: k.iso2 } },
          { extra: { choices: MAP_CHOICES } },
        );
      },
    },
  ],
  rounds: 5,
  timeLimitSec: 90,
  multiplayer: true,
};

// ───────────────────────── 3. Risk or Reward ─────────────────────────

const RISK = "risk-reward";

function wagerModes(): ModeDefinition[] {
  return proxyModes(RISK, riskSources(), ["choice"], { preferChoice: true }).map((m) => ({
    ...m,
    kinds: ["wager"],
    async build(c, ctx) {
      const r = await m.build(c, { ...ctx, preferChoice: true });
      if (r.handler !== "choice" || !r.pub.options) throw new Error("skip-kind:non-choice");
      const odds = oddsForDifficulty(c.difficulty);
      return {
        ...r,
        handler: "wager",
        pub: {
          ...r.pub,
          kind: "wager",
          prompt: `Topic: ${r.pub.modeLabel}. Difficulty ${"★".repeat(c.difficulty)}. Odds ${odds.label}. How many chips will you stake?`,
          media: undefined,
          options: undefined,
          timeLimitSec: (ctx.timeLimitSec ?? r.pub.timeLimitSec) + 10,
          extra: { ...(r.pub.extra ?? {}), odds },
        },
        secret: { ...r.secret, data: { ...(r.secret.data ?? {}), question: r.pub.prompt, options: r.pub.options, media: r.pub.media?.[0] } },
      } satisfies Round;
    },
  }));
}

let riskSourcesFn: () => GameDefinition[] = () => [];
export function setRiskSources(fn: () => GameDefinition[]) {
  riskSourcesFn = fn;
}
const riskSources = () => riskSourcesFn();

export const riskRewardGame: GameDefinition = {
  slug: RISK,
  name: "Risk & Reward",
  short: "Stake virtual chips on each question before you see it. Hit zero and you're out.",
  icon: "🎲",
  accent: ["#f59e0b", "#ef4444"],
  group: "party",
  original: true,
  rules: [
    "Everyone starts with 1,000 virtual chips (the host can change this). Chips are for fun only: no real money, no prizes.",
    "Each round you see the topic, difficulty and odds first, then stake 1 chip up to your whole balance. Your stake locks once placed.",
    "Right answer: you get your stake back plus profit at the odds shown (Evens pays 1 for 1). Wrong answer or no answer: you lose the stake.",
    "Hit zero chips and you're eliminated; you can keep watching. If only one player has chips left, they win.",
    "If the last players all go bust in the same round, whoever had more chips before it places higher. Equal balances share the place.",
  ],
  get modes() {
    return wagerModes();
  },
  rounds: 8,
  timeLimitSec: 20,
  multiplayer: true,
};

// ───────────────────────── 4. Speed Sort ─────────────────────────

const SORT = "speed-sort";

function sortRound(c: Candidate, ctx: BuildContext, label: string, prompt: string, buckets: [string, string], items: { label: string; bucket: 0 | 1 }[], explanation: string, source: string): Round {
  const withIds = shuffle(ctx.rng, items).map((it) => ({ ...it, id: Math.floor(ctx.rng() * 36 ** 7).toString(36) }));
  return genericRound(
    "sort",
    { c, modeLabel: `Speed sort · ${label}`, prompt, timeLimitSec: ctx.timeLimitSec ?? 25, explanation, source },
    { answerLabel: buckets.map((b, bi) => `${b}: ${withIds.filter((x) => x.bucket === bi).map((x) => x.label).join(", ")}`).join(" | "), data: { buckets: Object.fromEntries(withIds.map((x) => [x.id, x.bucket])) } },
    { options: withIds.map((x) => ({ id: x.id, label: x.label })), buckets },
  );
}

const VOWELS = "aeiou";
const CONS = "bcdfghjklmnprstvwz";

/** Pronounceable non-words, verified absent from the dictionary. */
function fakeWord(rng: Rng): string {
  for (;;) {
    const len = randInt(rng, 5, 8);
    let w = "";
    for (let i = 0; i < len; i++) w += i % 2 === 0 ? CONS[Math.floor(rng() * CONS.length)] : VOWELS[Math.floor(rng() * VOWELS.length)];
    if (!isDictionaryWord(w)) return w;
  }
}

let realWordPool: string[] | null = null;
function realWords(): string[] {
  if (!realWordPool) {
    // Common-ish words: from category lists, single words that are in the dictionary.
    realWordPool = CATEGORIES.flatMap((c) => c.entries.filter((e) => e.tier <= 2).map((e) => compact(e.name))).filter((w) => /^[a-z]{5,9}$/.test(w) && isDictionaryWord(w));
    realWordPool = [...new Set(realWordPool)];
  }
  return realWordPool;
}

export const speedSortGame: GameDefinition = {
  slug: SORT,
  name: "Speed Sort",
  short: "Eight items, two buckets, no time to think. Sort them fast.",
  icon: "🗂️",
  accent: ["#06b6d4", "#ec4899"],
  group: "party",
  original: true,
  rules: ["Tap a bucket for every item, then submit.", "Points scale with how many you sorted correctly.", "Faster submissions earn a speed bonus."],
  modes: [
    {
      id: "decade",
      kinds: ["sort"],
      label: "Before or after 2000",
      description: "Films released before or after the year 2000.",
      candidates: () => idx(SORT, "decade", 150, "movies/years", [2, 3, 3, 4]),
      build(c, ctx) {
        const before = sample(ctx.rng, MOVIES.filter((m) => m.year < 2000), 4);
        const after = sample(ctx.rng, MOVIES.filter((m) => m.year >= 2000), 4);
        return sortRound(c, ctx, "Films", "Released before 2000, or in 2000 and after?", ["Before 2000", "2000 or later"], [...before.map((m) => ({ label: m.title, bucket: 0 as const })), ...after.map((m) => ({ label: m.title, bucket: 1 as const }))], [...before, ...after].map((m) => `${m.title} (${m.year})`).join(", "), "Movie facts: public record.");
      },
    },
    {
      id: "continent",
      kinds: ["sort"],
      label: "Africa or Asia",
      description: "Sort countries by continent.",
      candidates: () => idx(SORT, "continent", 150, "geography/continents", [1, 2, 3, 4]),
      build(c, ctx) {
        const pool = (r: string) => famous(Math.min(4, c.difficulty + 1)).filter((x) => x.region === r && !TRANSCONTINENTAL.has(x.iso2));
        const a = sample(ctx.rng, pool("Africa"), 4);
        const b = sample(ctx.rng, pool("Asia"), 4);
        return sortRound(c, ctx, "Countries", "Is it in Africa or Asia?", ["Africa", "Asia"], [...a.map((x) => ({ label: x.name, bucket: 0 as const })), ...b.map((x) => ({ label: x.name, bucket: 1 as const }))], `Africa: ${a.map((x) => x.name).join(", ")} · Asia: ${b.map((x) => x.name).join(", ")}`, COUNTRY_SRC);
      },
    },
    {
      id: "realfake",
      kinds: ["sort"],
      label: "Real or fake word",
      description: "Spot the made-up words.",
      candidates: () => idx(SORT, "realfake", 200, "words/realfake", [2, 3, 3, 4]),
      build(c, ctx) {
        const real = sample(ctx.rng, realWords(), 4);
        const fake = Array.from({ length: 4 }, () => fakeWord(ctx.rng));
        return sortRound(c, ctx, "Words", "Real English word, or made up?", ["Real", "Fake"], [...real.map((w) => ({ label: w, bucket: 0 as const })), ...fake.map((w) => ({ label: w, bucket: 1 as const }))], `Real: ${real.join(", ")}. Fake words are generated and checked against a 275k-word dictionary.`, "Dictionary: an-array-of-english-words (MIT).");
      },
    },
    {
      id: "position",
      kinds: ["sort"],
      label: "Attacker or defender",
      description: "Forwards vs defenders.",
      candidates: () => idx(SORT, "position", 120, "football/positions", [2, 3, 3, 4]),
      build(c, ctx) {
        const f = sample(ctx.rng, FOOTBALLERS.filter((p) => p.position === "Forward"), 4);
        const d = sample(ctx.rng, FOOTBALLERS.filter((p) => p.position === "Defender"), 4);
        return sortRound(c, ctx, "Football", "Forward or defender?", ["Forward", "Defender"], [...f.map((p) => ({ label: p.name, bucket: 0 as const })), ...d.map((p) => ({ label: p.name, bucket: 1 as const }))], `Forwards: ${f.map((p) => p.name).join(", ")} · Defenders: ${d.map((p) => p.name).join(", ")}`, "Football data: public record.");
      },
    },
  ],
  rounds: 6,
  timeLimitSec: 25,
  multiplayer: true,
};

// ───────────────────────── 5. Common Ground ─────────────────────────

const COMMON = "common-ground";

function linkRound(c: Candidate, ctx: BuildContext, label: string, items: string[], link: string, wrong: string[], why: string, source: string): Round {
  return choiceRound({ c, rng: ctx.rng, modeLabel: `Common ground · ${label}`, prompt: "What do these three have in common?", media: [{ type: "words", items }], timeLimitSec: ctx.timeLimitSec ?? 18, correct: { label: link }, distractors: wrong.map((w) => ({ label: w })), explanation: why, source });
}

export const commonGroundGame: GameDefinition = {
  slug: COMMON,
  name: "Common Ground",
  short: "Three things, one hidden link. Find what connects them.",
  icon: "🔗",
  accent: ["#a855f7", "#14b8a6"],
  group: "trivia",
  original: true,
  rules: ["Three items share something — a director, a region, a national team, an artist.", "Pick the link from four options.", "Distractor links are plausible on purpose."],
  modes: [
    {
      id: "director",
      kinds: ["choice"],
      label: "Same director",
      description: "Three films, one director.",
      candidates: () => idx(COMMON, "director", 150, "movies/directors", [2, 3, 3, 4]),
      build(c, ctx) {
        const by = new Map<string, typeof MOVIES>();
        for (const m of MOVIES) by.set(m.director, [...(by.get(m.director) ?? []), m]);
        const [dir, films] = pick(ctx.rng, [...by.entries()].filter(([, l]) => l.length >= 3));
        const three = sample(ctx.rng, films, 3);
        const wrong = pickDistinct(ctx.rng, [...by.keys()].filter((d) => d !== dir), 3, (x) => x);
        return linkRound(c, ctx, "Films", three.map((m) => m.title), `Directed by ${dir}`, wrong.map((d) => `Directed by ${d}`), three.map((m) => `${m.title} (${m.year})`).join(", ") + ` — all ${dir}.`, "Movie facts: public record.");
      },
    },
    {
      id: "region",
      kinds: ["choice"],
      label: "Same region",
      description: "Three countries, one region.",
      candidates: () => idx(COMMON, "region", 200, "geography/regions", [1, 2, 3, 4]),
      build(c, ctx) {
        const by = new Map<string, Country[]>();
        for (const k of famous(Math.min(4, c.difficulty + 1)).filter((x) => !TRANSCONTINENTAL.has(x.iso2))) by.set(k.subregion, [...(by.get(k.subregion) ?? []), k]);
        const [sub, list] = pick(ctx.rng, [...by.entries()].filter(([s, l]) => s && l.length >= 3));
        const three = sample(ctx.rng, list, 3);
        const wrong = pickDistinct(ctx.rng, [...by.keys()].filter((s) => s && s !== sub), 3, (x) => x);
        return linkRound(c, ctx, "Countries", three.map((k) => k.name), `In ${sub}`, wrong.map((s) => `In ${s}`), `${three.map((k) => k.name).join(", ")} are all in ${sub}.`, COUNTRY_SRC);
      },
    },
    {
      id: "nation",
      kinds: ["choice"],
      label: "Same national team",
      description: "Three footballers, one country.",
      candidates: () => idx(COMMON, "nation", 150, "football/nations", [2, 3, 3, 4]),
      build(c, ctx) {
        const by = new Map<string, Footballer[]>();
        for (const p of FOOTBALLERS) by.set(p.nationality, [...(by.get(p.nationality) ?? []), p]);
        const [nat, ps] = pick(ctx.rng, [...by.entries()].filter(([, l]) => l.length >= 3));
        const three = sample(ctx.rng, ps, 3);
        const wrong = pickDistinct(ctx.rng, [...by.keys()].filter((n) => n !== nat), 3, (x) => x);
        return linkRound(c, ctx, "Football", three.map((p) => p.name), `Played for ${nat}`, wrong.map((n) => `Played for ${n}`), `${three.map((p) => p.name).join(", ")} all represented ${nat}.`, "Football data: public record.");
      },
    },
    {
      id: "decade",
      kinds: ["choice"],
      label: "Same decade",
      description: "Three films from the same decade.",
      candidates: () => idx(COMMON, "decade", 150, "movies/decades", [2, 3, 3, 4]),
      build(c, ctx) {
        const by = new Map<string, typeof MOVIES>();
        for (const m of MOVIES) by.set(decadeOf(m.year), [...(by.get(decadeOf(m.year)) ?? []), m]);
        const [dec, films] = pick(ctx.rng, [...by.entries()].filter(([, l]) => l.length >= 3));
        const three = sample(ctx.rng, films, 3);
        const wrong = pickDistinct(ctx.rng, [...by.keys()].filter((d) => d !== dec), 3, (x) => x);
        return linkRound(c, ctx, "Decades", three.map((m) => m.title), `Released in the ${dec}`, wrong.map((d) => `Released in the ${d}`), three.map((m) => `${m.title} (${m.year})`).join(", "), "Movie facts: public record.");
      },
    },
  ],
  rounds: 10,
  timeLimitSec: 18,
  multiplayer: true,
};

// ───────────────────────── 6. Closest Wins ─────────────────────────

const CLOSEST = "closest-wins";

export const closestWinsGame: GameDefinition = {
  slug: CLOSEST,
  name: "Closest Wins",
  short: "Big-number estimation. Nobody knows exactly — the closest guess takes the points.",
  icon: "🎯",
  accent: ["#f97316", "#22c55e"],
  group: "trivia",
  original: true,
  rules: ["Estimate the number with the slider or by typing.", "Scoring is by how close you are (on a log scale for huge numbers).", "In party mode, compare your guesses at the reveal."],
  modes: [
    {
      id: "area",
      kinds: ["number"],
      label: "Country area",
      description: "How big is this country?",
      candidates: () => famous(3).map((k) => ({ key: `closest:area:${k.iso2}`, subject: `country:${k.iso2}`, topic: "geography/area", difficulty: k.fame + 1, mode: "area", gameSlug: CLOSEST, ref: k.iso2 })),
      build(c, ctx) {
        const k = COUNTRIES.find((x) => x.iso2 === c.ref)!;
        const v = Math.round(k.areaKm2);
        return numberRound({ c, modeLabel: "Closest wins · Area", prompt: `How large is ${k.flagEmoji} ${k.name}, in square kilometres?`, timeLimitSec: ctx.timeLimitSec ?? 25, value: v, min: 1, max: 20_000_000, scale: "log", tolerance: 0.35, unit: "km²", step: 1, explanation: `${k.name}: ${v.toLocaleString("en")} km².`, source: COUNTRY_SRC });
      },
    },
    {
      id: "distance",
      kinds: ["number"],
      label: "Distance",
      description: "How far apart are two countries?",
      candidates: () => idx(CLOSEST, "distance", 300, "geography/distance", [2, 3, 3, 4]),
      build(c, ctx) {
        const [a, b] = sample(ctx.rng, famous(2), 2);
        const km = distanceKm(a, b);
        return numberRound({ c, modeLabel: "Closest wins · Distance", prompt: `How far is it from the centre of ${a.flagEmoji} ${a.name} to the centre of ${b.flagEmoji} ${b.name}?`, timeLimitSec: ctx.timeLimitSec ?? 25, value: km, min: 10, max: 20_000, scale: "log", tolerance: 0.3, unit: "km", step: 10, explanation: `${km.toLocaleString("en")} km as the crow flies between the countries' geographic centres.`, source: COUNTRY_SRC });
      },
    },
    {
      id: "regioncount",
      kinds: ["number"],
      label: "How many countries",
      description: "Count the sovereign states in a region.",
      candidates: () => [...new Set(SOVEREIGN.map((k) => k.subregion))].filter(Boolean).map((sub) => ({ key: `closest:count:${compact(sub)}`, subject: `region:${compact(sub)}`, topic: "geography/regions", difficulty: 3, mode: "regioncount", gameSlug: CLOSEST, ref: sub })),
      build(c, ctx) {
        const n = SOVEREIGN.filter((k) => k.subregion === c.ref).length;
        return numberRound({ c, modeLabel: "Closest wins · Regions", prompt: `How many independent countries are in ${c.ref}?`, timeLimitSec: ctx.timeLimitSec ?? 20, value: n, min: 1, max: 60, tolerance: Math.max(2, Math.round(n * 0.25)), explanation: `${n}: ${SOVEREIGN.filter((k) => k.subregion === c.ref).map((k) => k.name).join(", ")}.`, source: COUNTRY_SRC });
      },
    },
  ],
  rounds: 8,
  timeLimitSec: 25,
  multiplayer: true,
};

// ───────────────────────── 7. Anagram Sprint ─────────────────────────

const ANAGRAM = "anagram";

function scramble(rng: Rng, word: string): string {
  const letters = word.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
  for (let i = 0; i < 20; i++) {
    const s = shuffle(rng, letters).join("");
    if (s !== letters.join("")) return s;
  }
  return letters.reverse().join("");
}

function anagramMode(catId: string, maxTier: number): ModeDefinition {
  const cat = CATEGORY_BY_ID.get(catId)!;
  const pool = cat.entries.filter((e) => e.tier <= maxTier && /^[A-Za-z]{4,10}$/.test(e.name));
  return {
    id: cat.id,
    kinds: ["text"],
    label: `${cat.icon} ${cat.label}`,
    description: `Unscramble ${cat.label.toLowerCase()}.`,
    candidates: () => pool.map((e) => ({ key: `anagram:${cat.id}:${compact(e.name)}`, subject: `word:${cat.id}:${compact(e.name)}`, topic: `words/${cat.id}`, difficulty: Math.min(5, e.tier + (e.name.length > 7 ? 1 : 0)), mode: cat.id, gameSlug: ANAGRAM, ref: e.name })),
    build(c, ctx) {
      const s = scramble(ctx.rng, c.ref);
      return textRound({ c, modeLabel: `Anagram · ${cat.label}`, prompt: `Unscramble this ${cat.label.toLowerCase().replace(/s$/, "")}:`, media: [{ type: "words", items: s.split("") }], timeLimitSec: ctx.timeLimitSec ?? 25, accept: [c.ref], answerLabel: c.ref, placeholder: `${c.ref.length} letters…`, explanation: `${s} → ${c.ref.toUpperCase()}`, source: "PartyVerse category lists." });
    },
  };
}

export const anagramGame: GameDefinition = {
  slug: ANAGRAM,
  name: "Anagram Sprint",
  short: "Scrambled countries, animals, capitals and more. Unscramble before the clock does.",
  icon: "🔀",
  accent: ["#eab308", "#8b5cf6"],
  group: "words",
  original: true,
  rules: ["Rearrange the letters to find the answer — the category is your hint.", "Three tries per word.", "Speed and streaks boost your score."],
  modes: [anagramMode("countries", 3), anagramMode("animals", 3), anagramMode("capitals", 3), anagramMode("foods", 2), anagramMode("elements", 3), anagramMode("sports", 3), anagramMode("jobs", 2)],
  rounds: 10,
  timeLimitSec: 25,
  multiplayer: true,
};

// ───────────────────────── 8. Letter Drop ─────────────────────────

const DROP = "letter-drop";

function dropClues(rng: Rng, word: string, hint: string): string[] {
  const chars = word.toUpperCase().split("");
  const letterIdx = chars.map((ch, i) => (/[A-Z]/.test(ch) ? i : -1)).filter((i) => i >= 0);
  const order = shuffle(rng, letterIdx);
  const shown = new Set<number>();
  const mask = () => chars.map((ch, i) => (/[A-Z]/.test(ch) ? (shown.has(i) ? ch : "_") : ch === " " ? "   " : ch)).join(" ");
  const clues = [`${hint} · ${letterIdx.length} letters\n${mask()}`];
  // Reveal roughly 20% of letters per clue, never the whole word.
  const steps = Math.min(4, Math.max(2, Math.floor(letterIdx.length / 2)));
  const per = Math.max(1, Math.floor((letterIdx.length - 1) / (steps + 1)));
  for (let s = 0; s < steps; s++) {
    for (let k = 0; k < per && shown.size < letterIdx.length - 1; k++) shown.add(order[shown.size]);
    clues.push(mask());
  }
  return clues;
}

function dropMode(catId: string, maxTier: number): ModeDefinition {
  const cat = CATEGORY_BY_ID.get(catId)!;
  const pool = cat.entries.filter((e) => e.tier <= maxTier && /^[A-Za-z ]{5,18}$/.test(e.name));
  return {
    id: cat.id,
    kinds: ["clues"],
    label: `${cat.icon} ${cat.label}`,
    description: `Hidden ${cat.label.toLowerCase()}, letters fall in one by one.`,
    candidates: () => pool.map((e) => ({ key: `drop:${cat.id}:${compact(e.name)}`, subject: `word:${cat.id}:${compact(e.name)}`, topic: `words/${cat.id}`, difficulty: Math.min(5, e.tier + 1), mode: cat.id, gameSlug: DROP, ref: e.name })),
    build(c, ctx) {
      const entry = cat.entries.find((e) => e.name === c.ref)!;
      return cluesRound({ c, modeLabel: `Letter drop · ${cat.label}`, prompt: "Name it before the letters give it away.", clues: dropClues(ctx.rng, c.ref, `${cat.icon} ${cat.label}`), accept: [entry.name, ...entry.aliases], answerLabel: entry.name, timeLimitSec: ctx.timeLimitSec ?? 35, explanation: entry.name, source: "PartyVerse category lists." });
    },
  };
}

export const letterDropGame: GameDefinition = {
  slug: DROP,
  name: "Letter Drop",
  short: "A hidden answer, blanks only. Letters drop in as clues — guess with as few as possible.",
  icon: "🔡",
  accent: ["#3b82f6", "#ec4899"],
  group: "words",
  original: true,
  rules: ["You see the category and the word's shape.", "Ask for more letters, or guess — wrong guesses also drop a letter.", "Fewer letters revealed = more points."],
  modes: [dropMode("countries", 3), dropMode("animals", 3), dropMode("movies", 2), dropMode("footballers", 2), dropMode("capitals", 3), dropMode("fictional", 2), dropMode("videogames", 2)],
  rounds: 8,
  timeLimitSec: 35,
  multiplayer: true,
};

// ───────────────────────── 9. Hive Mind ─────────────────────────

const HIVE = "hive-mind";

function hiveMode(cat: Category): ModeDefinition {
  return {
    id: cat.id,
    kinds: ["rare"],
    label: `${cat.icon} ${cat.label}`,
    description: `Say what everyone else says: ${cat.prompt.toLowerCase()}.`,
    candidates: () => [{ key: `hive:${cat.id}`, subject: `hivecat:${cat.id}`, topic: `hive/${cat.id}`, difficulty: 2, mode: cat.id, gameSlug: HIVE, ref: "" }],
    build(c, ctx) {
      return genericRound(
        "rare",
        { c, modeLabel: `Hive mind · ${cat.label}`, prompt: `${cat.prompt} — the most popular answer wins!`, timeLimitSec: ctx.timeLimitSec ?? 15 },
        { answerLabel: "The crowd's favourite", data: { categoryId: cat.id, common: true }, explanation: "Hive Mind scores the opposite of Rare Words: the more players who give an answer, the more it's worth." },
        { input: { placeholder: "Think like everyone else…" } },
      );
    },
  };
}

export const hiveMindGame: GameDefinition = {
  slug: HIVE,
  name: "Hive Mind",
  short: "The anti-Rare-Words: name the answer most people would give.",
  icon: "🐝",
  accent: ["#facc15", "#f97316"],
  group: "party",
  original: true,
  rules: ["Give one valid answer for the category.", "Popular answers score up to 100; obscure ones score little.", "Popularity is learned live from every player's answers."],
  modes: CATEGORIES.filter((c) => !["famous", "cities"].includes(c.id)).map(hiveMode),
  rounds: 8,
  timeLimitSec: 15,
  multiplayer: true,
  scoring: { speedBonus: 0 },
};

// ───────────────────────── 10. Word Forge ─────────────────────────

const FORGE = "word-forge";

function longestWord(letters: string): string {
  let best = "";
  const counts = new Map<string, number>();
  for (const ch of letters) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const w of dictionaryWords()) {
    if (w.length <= best.length || w.length > letters.length) continue;
    const need = new Map<string, number>();
    let ok = true;
    for (const ch of w) {
      const n = (need.get(ch) ?? 0) + 1;
      if (n > (counts.get(ch) ?? 0)) {
        ok = false;
        break;
      }
      need.set(ch, n);
    }
    if (ok) best = w;
  }
  return best;
}

const LETTER_FREQ = "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssuuuuddddgggbbccmmppffhhvvwwyykjxz";

export const wordForgeGame: GameDefinition = {
  slug: FORGE,
  name: "Word Forge",
  short: "Nine letters. Forge the longest real word you can.",
  icon: "⚒️",
  accent: ["#f97316", "#8b5cf6"],
  group: "words",
  original: true,
  rules: ["Make the longest dictionary word using only the letters shown (each at most as many times as it appears).", "Score = your length compared with the longest possible word.", "Three tries if your word isn't valid."],
  modes: [
    {
      id: "nine",
      kinds: ["letters"],
      label: "Nine letters",
      description: "Classic nine-letter forge.",
      candidates: () => idx(FORGE, "nine", 500, "words/forge", [2, 3, 3, 4]),
      build(c, ctx) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const vowels = randInt(ctx.rng, 3, 4);
          const pool = LETTER_FREQ.split("");
          const vs = Array.from({ length: vowels }, () => pick(ctx.rng, pool.filter((x) => VOWELS.includes(x))));
          const cs = Array.from({ length: 9 - vowels }, () => pick(ctx.rng, pool.filter((x) => !VOWELS.includes(x))));
          const letters = shuffle(ctx.rng, [...vs, ...cs]).join("");
          const best = longestWord(letters);
          if (best.length < 6) continue;
          return genericRound(
            "letters",
            { c, modeLabel: "Word Forge", prompt: "Make the longest word you can.", timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `One of the longest possible: ${best.toUpperCase()} (${best.length} letters).`, source: "Dictionary: an-array-of-english-words (MIT)." },
            { answerLabel: best.toUpperCase(), data: { letters, best: best.length, minLen: 3 } },
            { extra: { letters: letters.toUpperCase().split("") } },
          );
        }
        throw new Error("no-good-letters");
      },
    },
  ],
  rounds: 5,
  timeLimitSec: 40,
  multiplayer: true,
  scoring: { speedBonus: 20 },
};

export const ORIGINAL_GAMES = (): GameDefinition[] => [rankItGame, mapMysteryGame, riskRewardGame, speedSortGame, commonGroundGame, closestWinsGame, anagramGame, letterDropGame, hiveMindGame, wordForgeGame];
