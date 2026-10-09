import * as FLAG_SVGS from "country-flag-icons/string/3x2";
import { COUNTRIES, COUNTRY_BY_ISO2, SIMILAR_FLAG_SETS, type Country } from "@/content/datasets/countries";
import { choiceRound, genericRound, makeOptions, orderRound, pickDistinct, revealRound, textRound } from "../build";
import { pick, randInt, sample, shuffle } from "../rng";
import type { BuildContext, Candidate, GameDefinition, ModeDefinition } from "../types";

const SLUG = "flags";

/**
 * Some territories share an identical flag with their parent (e.g. Bouvet Island uses Norway's).
 * Those are excluded automatically so no question has two correct answers.
 */
const FLAG_POOL: Country[] = (() => {
  const svgs = FLAG_SVGS as unknown as Record<string, string>;
  const bySvg = new Map<string, Country[]>();
  for (const c of COUNTRIES) {
    const svg = svgs[c.iso2];
    if (!svg) continue;
    const list = bySvg.get(svg) ?? [];
    list.push(c);
    bySvg.set(svg, list);
  }
  const out: Country[] = [];
  for (const list of bySvg.values()) {
    if (list.length === 1) out.push(list[0]);
    else {
      const sovereign = list.filter((c) => c.independent);
      if (sovereign.length === 1) out.push(sovereign[0]);
    }
  }
  return out;
})();

export const FLAG_COUNTRIES = FLAG_POOL;
const UN = FLAG_POOL.filter((c) => c.unMember || c.independent);

function diff(c: Country, bump = 0): number {
  return Math.max(1, Math.min(5, c.fame + bump));
}

function distractorCountries(ctx: BuildContext, c: Country, n: number, hard: boolean): Country[] {
  const sameRegion = UN.filter((x) => x.iso2 !== c.iso2 && x.subregion === c.subregion);
  const pool = hard && sameRegion.length >= n ? sameRegion : UN.filter((x) => x.iso2 !== c.iso2 && (hard ? x.region === c.region : true));
  return pickDistinct(ctx.rng, pool.length >= n ? pool : UN.filter((x) => x.iso2 !== c.iso2), n, (x) => x.iso2);
}

function flagMedia(ctx: BuildContext, iso: string, alt = "A country's flag") {
  return { type: "image" as const, url: ctx.media.flag(iso, { width: 480 }), alt, frame: "flag" as const };
}

function cand(mode: string, c: Country, bump = 0, extra = ""): Candidate {
  return { key: `flag:${mode}:${c.iso2}${extra}`, subject: `country:${c.iso2}`, topic: `geography/${c.region}`, difficulty: diff(c, bump), mode, gameSlug: SLUG, ref: c.iso2 };
}

const classic: ModeDefinition = {
  id: "classic",
  kinds: ["choice"],
  label: "Name that flag",
  description: "See a flag, pick the country.",
  candidates: () => FLAG_POOL.map((c) => cand("classic", c, c.unMember ? 0 : 1)),
  build(c, ctx) {
    const country = COUNTRY_BY_ISO2.get(c.ref)!;
    return choiceRound({
      c, rng: ctx.rng, modeLabel: "Name that flag", prompt: "Which country or territory does this flag belong to?",
      media: [flagMedia(ctx, country.iso2)], timeLimitSec: ctx.timeLimitSec ?? 15,
      correct: { label: country.name }, distractors: distractorCountries(ctx, country, 3, c.difficulty >= 3).map((d) => ({ label: d.name })),
      explanation: `${country.flagEmoji} ${country.name} — capital: ${country.capital.join(", ") || "none"}.`,
      source: "Flags: country-flag-icons (MIT) · Countries: mledoze/countries (ODbL)",
    });
  },
};

const typeIt: ModeDefinition = {
  id: "type",
  kinds: ["text"],
  label: "Type the country",
  description: "No options — type the country's name (typos forgiven).",
  candidates: () => UN.map((c) => cand("type", c, 1)),
  build(c, ctx) {
    const country = COUNTRY_BY_ISO2.get(c.ref)!;
    return textRound({
      c, modeLabel: "Type the country", prompt: "Type the name of this flag's country.",
      media: [flagMedia(ctx, country.iso2)], timeLimitSec: ctx.timeLimitSec ?? 20,
      accept: country.aliases, answerLabel: country.name, placeholder: "Country name…",
      explanation: `${country.flagEmoji} ${country.name}`,
    });
  },
};

const reverse: ModeDefinition = {
  id: "reverse",
  kinds: ["choice"],
  label: "Find the flag",
  description: "We name the country, you find its flag.",
  candidates: () => UN.map((c) => cand("reverse", c, 0)),
  build(c, ctx) {
    const country = COUNTRY_BY_ISO2.get(c.ref)!;
    const ds = distractorCountries(ctx, country, 3, c.difficulty >= 2);
    return choiceRound({
      c, rng: ctx.rng, modeLabel: "Find the flag", prompt: `Which flag belongs to ${country.name}?`, timeLimitSec: ctx.timeLimitSec ?? 15,
      correct: { label: "", media: flagMedia(ctx, country.iso2, "Flag option") },
      distractors: ds.map((d) => ({ label: "", media: flagMedia(ctx, d.iso2, "Flag option") })),
      answerLabel: country.name, explanation: `${country.flagEmoji} That's the flag of ${country.name}.`,
    });
  },
};

const partial: ModeDefinition = {
  id: "partial",
  kinds: ["choice"],
  label: "Flag fragment",
  description: "Only a slice of the flag is visible.",
  candidates: () => UN.filter((c) => c.fame <= 3).map((c) => cand("partial", c, 1)),
  build(c, ctx) {
    const country = COUNTRY_BY_ISO2.get(c.ref)!;
    const w = 0.34;
    const x = ctx.rng() * (1 - w);
    const y = ctx.rng() * (1 - w);
    return choiceRound({
      c, rng: ctx.rng, modeLabel: "Flag fragment", prompt: "This is a fragment of a flag. Whose is it?",
      media: [{ type: "image", url: ctx.media.flag(country.iso2, { crop: { x, y, w, h: w }, width: 360 }), alt: "Part of a flag", frame: "square" }],
      timeLimitSec: ctx.timeLimitSec ?? 20, correct: { label: country.name },
      distractors: distractorCountries(ctx, country, 3, true).map((d) => ({ label: d.name })),
      explanation: `${country.flagEmoji} ${country.name}`,
    });
  },
};

const similar: ModeDefinition = {
  id: "similar",
  kinds: ["choice"],
  label: "Lookalikes",
  description: "Tell apart flags that are infamously similar.",
  candidates: () =>
    SIMILAR_FLAG_SETS.flatMap((set, si) =>
      set.filter((iso) => COUNTRY_BY_ISO2.has(iso)).map((iso) => ({ ...cand("similar", COUNTRY_BY_ISO2.get(iso)!, 2, `:${si}`), ref: `${iso}:${si}` })),
    ),
  build(c, ctx) {
    const [iso, si] = c.ref.split(":");
    const country = COUNTRY_BY_ISO2.get(iso)!;
    const others = SIMILAR_FLAG_SETS[Number(si)].filter((x) => x !== iso && COUNTRY_BY_ISO2.has(x));
    return choiceRound({
      c, rng: ctx.rng, modeLabel: "Lookalikes", prompt: "Careful — these flags look alike. Which one is this?",
      media: [flagMedia(ctx, country.iso2)], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: country.name },
      distractors: others.map((o) => ({ label: COUNTRY_BY_ISO2.get(o)!.name })),
      explanation: `${country.flagEmoji} ${country.name}. Lookalikes: ${others.map((o) => COUNTRY_BY_ISO2.get(o)!.name).join(", ")}.`,
    });
  },
};

const progressive: ModeDefinition = {
  id: "reveal",
  kinds: ["reveal"],
  label: "Slow reveal",
  description: "The flag starts tiny and blurred and slowly appears. Guess early for more points.",
  candidates: () => UN.map((c) => cand("reveal", c, 0)),
  build(c, ctx) {
    const country = COUNTRY_BY_ISO2.get(c.ref)!;
    const cx = 0.2 + ctx.rng() * 0.6;
    const cy = 0.2 + ctx.rng() * 0.6;
    const sizes = [0.18, 0.32, 0.5, 0.75, 1];
    const stages = sizes.map((s, i) => {
      const w = s;
      const x = Math.min(Math.max(0, cx - w / 2), 1 - w);
      const y = Math.min(Math.max(0, cy - w / 2), 1 - w);
      return {
        type: "image" as const,
        url: ctx.media.flag(country.iso2, { crop: s < 1 ? { x, y, w, h: w } : undefined, blur: [8, 5, 3, 1.5, 0][i] || undefined, width: 420 }),
        alt: "Partially revealed flag",
        frame: s < 1 ? ("square" as const) : ("flag" as const),
      };
    });
    return revealRound({
      c, rng: ctx.rng, modeLabel: "Slow reveal", prompt: "Reveal more if you need to — every reveal costs points.", stages,
      timeLimitSec: ctx.timeLimitSec ?? 30, answerLabel: country.name, correct: { label: country.name },
      distractors: distractorCountries(ctx, country, 3, true).map((d) => ({ label: d.name })),
      explanation: `${country.flagEmoji} ${country.name}`,
    });
  },
};

const speed: ModeDefinition = {
  id: "speed",
  kinds: ["choice"],
  label: "Speed flags",
  description: "Five seconds per flag. Go!",
  candidates: () => FLAG_POOL.filter((c) => c.fame <= 3).map((c) => cand("speed", c, 0)),
  build(c, ctx) {
    const r = classic.build(c, { ...ctx, timeLimitSec: 6 }) as ReturnType<typeof choiceRound>;
    r.pub.modeLabel = "Speed flags";
    return r;
  },
};

const memory: ModeDefinition = {
  id: "memory",
  kinds: ["memory"],
  label: "Flag memory",
  description: "Memorise a grid of flags, then answer a question about it.",
  candidates: () => Array.from({ length: 120 }, (_, i) => ({ key: `flag:memory:${i}`, subject: `flagmemory:${i}`, topic: "geography/memory", difficulty: 2 + (i % 3), mode: "memory", gameSlug: SLUG, ref: String(i) })),
  build(c, ctx) {
    const n = 3 + c.difficulty; // 5..7 flags
    const shown = sample(ctx.rng, UN.filter((x) => x.fame <= 3), n);
    const notShown = pickDistinct(ctx.rng, UN.filter((x) => x.fame <= 3 && !shown.includes(x)), 3, (x) => x.iso2);
    const qType = randInt(ctx.rng, 0, 1);
    let question: string;
    let correct: Country;
    let distractors: Country[];
    if (qType === 0) {
      correct = pick(ctx.rng, shown);
      distractors = notShown;
      question = "Which of these countries' flags was in the grid?";
    } else {
      correct = notShown[0];
      distractors = sample(ctx.rng, shown, 3);
      question = "Which of these countries' flags was NOT in the grid?";
    }
    const { options, correctId } = makeOptions(ctx.rng, { label: correct.name }, distractors.map((d) => ({ label: d.name })));
    return genericRound(
      "memory",
      { c, modeLabel: "Flag memory", prompt: "Memorise these flags!", timeLimitSec: ctx.timeLimitSec ?? 15 },
      { answerLabel: correct.name, correctOptionId: correctId, data: { question, options }, explanation: `The grid showed: ${shown.map((s) => s.name).join(", ")}.` },
      { extra: { study: shown.map((s) => ({ type: "image", url: ctx.media.flag(s.iso2, { width: 240 }), alt: "Flag", frame: "flag" })), studySeconds: 3 + n } },
    );
  },
};

const match: ModeDefinition = {
  id: "match",
  kinds: ["order"],
  label: "Match them up",
  description: "Drag each country name next to its flag.",
  candidates: () => Array.from({ length: 150 }, (_, i) => ({ key: `flag:match:${i}`, subject: `flagmatch:${i}`, topic: "geography/match", difficulty: 1 + (i % 4), mode: "match", gameSlug: SLUG, ref: String(i) })),
  build(c, ctx) {
    const pool = UN.filter((x) => x.fame <= Math.min(4, c.difficulty + 1));
    const four = sample(ctx.rng, pool, 4);
    const r = orderRound({
      c, rng: ctx.rng, modeLabel: "Match them up", prompt: "Put the country names in the same order as the flags.",
      media: four.map((f) => ({ type: "image" as const, url: ctx.media.flag(f.iso2, { width: 200 }), alt: "Flag", frame: "flag" as const })),
      timeLimitSec: ctx.timeLimitSec ?? 30, items: four.map((f) => ({ label: f.name })), labels: ["Flag 1", "Flag 4"],
      explanation: four.map((f, i) => `${i + 1}. ${f.flagEmoji} ${f.name}`).join(" · "),
    });
    r.pub.extra = { ...r.pub.extra, matchMedia: true };
    return r;
  },
};

export const flagsGame: GameDefinition = {
  slug: SLUG,
  name: "Guess the Flag",
  short: "250 flags, eight ways to play — from lookalikes to slow reveals.",
  icon: "🚩",
  accent: ["#22d3ee", "#6366f1"],
  group: "visual",
  rules: ["A flag appears — name the country or territory.", "Faster answers score more; streaks multiply.", "Modes include lookalikes, fragments, slow reveals, memory grids and matching."],
  modes: [classic, typeIt, reverse, partial, similar, progressive, speed, memory, match],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

export { shuffle };
