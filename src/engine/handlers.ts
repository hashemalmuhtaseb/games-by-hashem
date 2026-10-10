import { CATEGORY_BY_ID, resolveAnswer, firstLetter } from "@/content/categories";
import { COUNTRIES, distanceKm, direction, type Country } from "@/content/datasets/countries";
import { compact, findMatch, matchesAny, normalize } from "./normalize";
import { clueQuality, closeness, computePoints } from "./scoring";
import { distanceOf, parseGuess } from "./closest";
import { checkStake, oddsForDifficulty, profitFor, wagerNet, type Odds } from "./chips";
import { rarityFor, answerKey, commonPointsFromProbability } from "./rarity";
import { isDictionaryWord, botWord } from "./dictionary";
import type { ActContext, ActResult, Action, PlayerRoundState, Round, RoundHandler, RoundKind } from "./types";

const MAX_TEXT = 80;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > MAX_TEXT) return null;
  return t;
}

function elapsedMs(state: PlayerRoundState, ctx: ActContext, from?: number): number {
  return Math.max(0, ctx.now - (from ?? state.startedAt));
}

/** Marks the round finished for this player and computes points. */
export function finish(
  round: Round,
  state: PlayerRoundState,
  ctx: ActContext,
  r: { correct: boolean; quality?: number; speed?: boolean; streak?: boolean; rarityPoints?: number; fixedPoints?: number; answerLabel?: string; from?: number },
): void {
  state.done = true;
  state.correct = r.correct;
  state.quality = r.quality ?? (r.correct ? 1 : 0);
  if (r.answerLabel !== undefined) state.answerLabel = r.answerLabel;
  if (r.fixedPoints !== undefined) {
    state.points = r.fixedPoints;
    state.breakdown = { base: r.fixedPoints, speed: 0, difficulty: 0, streak: 0, total: r.fixedPoints };
    return;
  }
  const bd = computePoints(ctx.scoring, {
    correct: r.correct,
    quality: state.quality,
    elapsedMs: elapsedMs(state, ctx, r.from),
    timeLimitMs: round.pub.timeLimitSec * 1000,
    difficulty: round.difficulty,
    streak: r.streak === false ? 0 : ctx.streak,
    speed: r.speed,
    rarityPoints: r.rarityPoints,
  });
  state.points = bd.total;
  state.breakdown = bd;
}

function optionLabel(round: Round, id: string): string | undefined {
  return round.pub.options?.find((o) => o.id === id)?.label;
}

// ───────────────────────── choice ─────────────────────────
const choice: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type !== "answer") return { error: "unsupported" };
    const id = typeof action.value === "string" ? action.value : "";
    if (!round.pub.options?.some((o) => o.id === id)) return { error: "invalid option" };
    const correct = id === round.secret.correctOptionId;
    finish(round, state, ctx, { correct, answerLabel: optionLabel(round, id) ?? id });
    return { feedback: { correct } };
  },
};

// ───────────────────────── text (3 tries) ─────────────────────────
const text: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty answer" };
    state.attempts.push(v);
    if (matchesAny(v, round.secret.accept ?? [])) {
      const wrong = state.attempts.length - 1;
      finish(round, state, ctx, { correct: true, quality: Math.max(0.3, 1 - wrong * ctx.scoring.wrongAttemptPenalty), answerLabel: v });
      return { feedback: { correct: true } };
    }
    const left = 3 - state.attempts.length;
    if (left <= 0) {
      finish(round, state, ctx, { correct: false, answerLabel: v });
      return { feedback: { correct: false, attemptsLeft: 0 } };
    }
    return { feedback: { correct: false, attemptsLeft: left } };
  },
};

// ───────────────────────── number ─────────────────────────
// Closeness only: no speed bonus and no streak multiplier, so within a round a farther guess can
// never out-score a closer one. Multiplayer rooms add a bonus for the closest player(s).
const number: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type !== "answer") return { error: "unsupported" };
    const n = parseGuess(action.value);
    const spec = round.secret.numeric!;
    const num = round.pub.input?.numeric;
    if (n === null) return { error: "Enter a number." };
    if (num && (n < num.min || n > num.max)) return { error: `Enter a number between ${num.min.toLocaleString("en")} and ${num.max.toLocaleString("en")}.` };
    const q = closeness(n, spec.value, spec.scale, spec.tolerance);
    state.data.guess = n;
    state.data.distance = distanceOf(n, spec.value);
    finish(round, state, ctx, {
      correct: q >= 0.6,
      quality: q,
      speed: false,
      streak: false,
      answerLabel: `${n.toLocaleString("en", { maximumFractionDigits: 6 })}${spec.unit ? " " + spec.unit : ""}`,
    });
    return { feedback: { quality: q } };
  },
};

// ───────────────────────── progressive clues ─────────────────────────
const clues: RoundHandler = {
  initState: () => ({ cluesUsed: 1 }),
  act(round, state, action, ctx) {
    const all = round.secret.clues ?? [];
    const revealNext = (): ActResult => {
      if (state.cluesUsed >= all.length) return { error: "no more clues" };
      state.cluesUsed++;
      return { reveal: { clue: all[state.cluesUsed - 1], index: state.cluesUsed - 1 } };
    };
    if (action.type === "hint") return revealNext();
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const total = round.pub.totalClues ?? all.length;
    let correct = false;
    let label = "";
    if (round.pub.options) {
      const id = typeof action.value === "string" ? action.value : "";
      if (!round.pub.options.some((o) => o.id === id)) return { error: "invalid option" };
      correct = id === round.secret.correctOptionId;
      label = optionLabel(round, id) ?? "";
    } else {
      const v = str(action.value);
      if (!v) return { error: "empty answer" };
      label = v;
      correct = matchesAny(v, round.secret.accept ?? []);
    }
    state.attempts.push(label);
    if (correct) {
      const q = clueQuality(state.cluesUsed, total, ctx.scoring.cluePenalty) * Math.max(0.4, 1 - (state.attempts.length - 1) * 0.15);
      finish(round, state, ctx, { correct: true, quality: q, answerLabel: label, speed: false });
      return { feedback: { correct: true, cluesUsed: state.cluesUsed } };
    }
    // A wrong guess costs a clue. Choice rounds end on the first wrong answer.
    if (round.pub.options || state.attempts.length >= 3 || state.cluesUsed >= all.length) {
      finish(round, state, ctx, { correct: false, answerLabel: label });
      return { feedback: { correct: false } };
    }
    const r = revealNext();
    return { feedback: { correct: false, attemptsLeft: 3 - state.attempts.length }, reveal: r.reveal };
  },
};

// Progressive image reveal re-uses the clue machinery with media stages.
const reveal: RoundHandler = {
  initState: () => ({ cluesUsed: 1 }),
  act(round, state, action, ctx) {
    const stages = round.secret.stages ?? [];
    if (action.type === "hint") {
      if (state.cluesUsed >= stages.length) return { error: "fully revealed" };
      state.cluesUsed++;
      return { reveal: { media: stages[state.cluesUsed - 1], index: state.cluesUsed - 1 } };
    }
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    let correct: boolean;
    let label: string;
    if (round.pub.options) {
      const id = typeof action.value === "string" ? action.value : "";
      if (!round.pub.options.some((o) => o.id === id)) return { error: "invalid option" };
      correct = id === round.secret.correctOptionId;
      label = optionLabel(round, id) ?? "";
    } else {
      const v = str(action.value);
      if (!v) return { error: "empty answer" };
      correct = matchesAny(v, round.secret.accept ?? []);
      label = v;
    }
    state.attempts.push(label);
    if (correct) {
      const q = clueQuality(state.cluesUsed, stages.length, ctx.scoring.cluePenalty * 1.2);
      finish(round, state, ctx, { correct: true, quality: q, answerLabel: label, speed: false });
      return { feedback: { correct: true } };
    }
    if (round.pub.options || state.attempts.length >= 3) {
      finish(round, state, ctx, { correct: false, answerLabel: label });
      return { feedback: { correct: false } };
    }
    return { feedback: { correct: false, attemptsLeft: 3 - state.attempts.length } };
  },
};

// ───────────────────────── order ─────────────────────────
const order: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type !== "answer" || !Array.isArray(action.value)) return { error: "unsupported" };
    const ids = action.value as unknown[];
    const want = round.secret.order ?? [];
    if (ids.length !== want.length || new Set(ids).size !== ids.length || !ids.every((x) => typeof x === "string" && want.includes(x)))
      return { error: "invalid order" };
    let right = 0;
    ids.forEach((id, i) => (id === want[i] ? right++ : 0));
    // Kendall-style pair agreement gives partial credit for nearly-right orders.
    let pairs = 0;
    let agree = 0;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        pairs++;
        if (want.indexOf(ids[i] as string) < want.indexOf(ids[j] as string)) agree++;
      }
    const q = right === want.length ? 1 : Math.max(0, (agree / pairs - 0.5) * 2) * 0.8;
    finish(round, state, ctx, { correct: right === want.length, quality: q, answerLabel: `${right}/${want.length} in place` });
    return { feedback: { positionsCorrect: right } };
  },
};

// ───────────────────────── groups (Connections) ─────────────────────────
const groups: RoundHandler = {
  initState: () => ({ data: { found: [] as number[], mistakes: 0 } }),
  act(round, state, action, ctx) {
    const gs = round.secret.groups ?? [];
    const data = state.data as { found: number[]; mistakes: number };
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false, quality: data.found.length / 4 * 0.5, speed: false });
      return {};
    }
    if (action.type !== "answer" || !Array.isArray(action.value) || action.value.length !== 4) return { error: "select four" };
    const pick = new Set(action.value as string[]);
    if (pick.size !== 4) return { error: "select four" };
    const gi = gs.findIndex((g, i) => !data.found.includes(i) && g.ids.every((id) => pick.has(id)));
    if (gi >= 0) {
      data.found.push(gi);
      const g = gs[gi];
      if (data.found.length === gs.length) {
        finish(round, state, ctx, { correct: true, quality: Math.max(0.4, 1 - data.mistakes * 0.15), speed: false, answerLabel: `${gs.length} groups, ${data.mistakes} mistakes` });
      }
      return { feedback: { correct: true, group: { label: g.label, ids: g.ids, level: g.level } } };
    }
    data.mistakes++;
    const oneAway = gs.some((g, i) => !data.found.includes(i) && g.ids.filter((id) => pick.has(id)).length === 3);
    if (data.mistakes >= 4) {
      finish(round, state, ctx, { correct: false, quality: (data.found.length / gs.length) * 0.5, speed: false, answerLabel: `${data.found.length} groups found` });
      return { feedback: { correct: false, oneAway, mistakes: data.mistakes } };
    }
    return { feedback: { correct: false, oneAway, mistakes: data.mistakes } };
  },
};

// ───────────────────────── multi (Name Five / Category Battle) ─────────────────────────
const multi: RoundHandler = {
  initState: () => ({ data: { found: [] as string[], invalid: 0 } }),
  async act(round, state, action, ctx) {
    const data = state.data as { found: string[]; invalid: number; foundLabels?: string[] };
    const target = round.pub.input?.target ?? 5;
    const done = () => {
      const q = Math.min(1, data.found.length / target);
      finish(round, state, ctx, { correct: data.found.length >= target, quality: q, speed: data.found.length >= target, answerLabel: (data.foundLabels ?? []).join(", ") });
    };
    if (action.type === "finish" || action.type === "give-up") {
      done();
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty answer" };
    const sd = round.secret.data as { categoryId?: string; letter?: string; accept?: { name: string; aliases: string[] }[] };
    let canonical: string | null = null;
    if (sd.accept) {
      const m = findMatch(v, sd.accept.map((a) => ({ value: a.name, names: [a.name, ...a.aliases] })));
      canonical = m?.value ?? null;
    } else if (sd.categoryId) {
      const cat = CATEGORY_BY_ID.get(sd.categoryId)!;
      const e = resolveAnswer(cat, v);
      if (e && (!sd.letter || firstLetter(e.name) === sd.letter)) canonical = e.name;
    }
    if (!canonical) {
      data.invalid++;
      return { feedback: { accepted: false, reason: "not recognised" } };
    }
    if (data.found.includes(canonical)) return { feedback: { accepted: false, reason: "already counted", canonical } };
    data.found.push(canonical);
    data.foundLabels = [...(data.foundLabels ?? []), canonical];
    if (data.found.length >= target) done();
    return { feedback: { accepted: true, canonical, count: data.found.length } };
  },
  timeout(round, state, ctx) {
    const data = state.data as { found: string[]; foundLabels?: string[] };
    const target = round.pub.input?.target ?? 5;
    finish(round, state, ctx, { correct: data.found.length >= target, quality: Math.min(1, data.found.length / target), speed: false, answerLabel: (data.foundLabels ?? []).join(", ") });
  },
};

// ───────────────────────── rare ─────────────────────────
const rare: RoundHandler = {
  async act(round, state, action, ctx) {
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty answer" };
    const sd = round.secret.data as { categoryId: string; letter?: string };
    const cat = CATEGORY_BY_ID.get(sd.categoryId)!;
    const e = resolveAnswer(cat, v);
    if (!e || (sd.letter && firstLetter(e.name) !== sd.letter)) {
      // Invalid answers lose points; fabricated words never score.
      state.data.answerKey = null;
      finish(round, state, ctx, { correct: false, fixedPoints: -10, answerLabel: v });
      return { feedback: { valid: false } };
    }
    const stats = await ctx.services.rarity.stats(cat.id);
    const r = rarityFor(cat, e, stats);
    // Hive Mind scores the opposite way: popular answers win.
    const pts = (sd as { common?: boolean }).common ? commonPointsFromProbability(r.probability) : r.points;
    await ctx.services.rarity.record(cat.id, e, ctx.playerId);
    state.data.answerKey = answerKey(e);
    state.data.canonical = e.name;
    state.data.probability = r.probability;
    finish(round, state, ctx, { correct: true, rarityPoints: pts, speed: false, answerLabel: e.name });
    return { feedback: { valid: true, canonical: e.name, rarityPoints: pts, percent: Math.round(r.probability * 1000) / 10 } };
  },
};

// ───────────────────────── sort ─────────────────────────
const sort: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type !== "answer" || typeof action.value !== "object" || !action.value) return { error: "unsupported" };
    const want = (round.secret.data as { buckets: Record<string, 0 | 1> }).buckets;
    const got = action.value as Record<string, unknown>;
    let right = 0;
    const total = Object.keys(want).length;
    for (const [id, b] of Object.entries(want)) if (got[id] === b) right++;
    finish(round, state, ctx, { correct: right === total, quality: right / total, answerLabel: `${right}/${total} sorted` });
    return { feedback: { right, total } };
  },
};

// ───────────────────────── map (country distance) ─────────────────────────
const countryMatchers = COUNTRIES.filter((c) => c.independent || c.unMember).map((c) => ({ value: c, names: c.aliases }));
const map: RoundHandler = {
  initState: () => ({ data: { guesses: [] as { name: string; km: number; dir: string }[] } }),
  act(round, state, action, ctx) {
    const data = state.data as { guesses: { name: string; km: number; dir: string; pct: number }[] };
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty answer" };
    const m = findMatch<Country>(v, countryMatchers);
    if (!m) return { feedback: { unknown: true } };
    const target = (round.secret.data as { iso2: string }).iso2;
    const t = COUNTRIES.find((c) => c.iso2 === target)!;
    if (data.guesses.some((g) => g.name === m.value.name)) return { feedback: { duplicate: true } };
    const km = distanceKm(m.value, t);
    const g = { name: m.value.name, km, dir: m.value.iso2 === target ? "🎯" : direction(m.value, t), pct: Math.max(0, Math.round(100 - (km / 20000) * 100)) };
    data.guesses.push(g);
    if (m.value.iso2 === target) {
      finish(round, state, ctx, { correct: true, quality: Math.max(0.2, 1 - (data.guesses.length - 1) * 0.15), speed: false, answerLabel: m.value.name });
      return { feedback: { guess: g, correct: true } };
    }
    if (data.guesses.length >= 6) {
      // Partial credit for getting close.
      const best = Math.min(...data.guesses.map((x) => x.km));
      finish(round, state, ctx, { correct: false, quality: best < 1000 ? 0.25 : best < 2500 ? 0.1 : 0, speed: false, answerLabel: m.value.name });
    }
    return { feedback: { guess: g, correct: false, left: 6 - data.guesses.length } };
  },
};

// ───────────────────────── wager ─────────────────────────
// Risk & Reward. `points` for this handler is the NET chip change (+profit or −stake); the room or
// solo session owns the balance and applies it exactly once when the round settles.
function roundOdds(round: Round): Odds {
  return (round.pub.extra?.odds as Odds | undefined) ?? oddsForDifficulty(round.difficulty);
}

const wager: RoundHandler = {
  initState: () => ({ data: { bet: null as number | null } }),
  act(round, state, action, ctx) {
    const data = state.data as { bet: number | null; balance?: number };
    const odds = roundOdds(round);
    if (action.type === "bet") {
      // The first accepted stake locks the round for this player: no changes, no second stake.
      if (data.bet !== null) return { error: "Your stake is locked in for this round." };
      const balance = ctx.balance ?? 0;
      const check = checkStake(action.value, balance);
      if (!check.ok) return { error: check.error };
      data.bet = check.stake!;
      data.balance = balance;
      state.data.betAt = ctx.now;
      return {
        feedback: { stake: data.bet, payout: data.bet + profitFor(data.bet, odds), loss: data.bet },
        reveal: { options: round.secret.data?.options, prompt: round.secret.data?.question, media: round.secret.data?.media },
      };
    }
    if (action.type !== "answer") return { error: "unsupported" };
    if (data.bet === null) return { error: "Place your stake first." };
    const opts = round.secret.data?.options as { id: string; label: string }[];
    const id = typeof action.value === "string" ? action.value : "";
    if (!opts.some((o) => o.id === id)) return { error: "invalid option" };
    const correct = id === round.secret.correctOptionId;
    const net = wagerNet(data.bet, correct, odds);
    state.data.net = net;
    finish(round, state, ctx, { correct, fixedPoints: net, answerLabel: opts.find((o) => o.id === id)?.label });
    return { feedback: { correct, net } };
  },
  timeout(round, state, ctx) {
    // Staked but didn't answer in time: the stake is lost. No stake: nothing changes.
    const data = state.data as { bet: number | null };
    const net = wagerNet(data.bet, false, roundOdds(round));
    state.data.net = net;
    finish(round, state, ctx, { correct: false, fixedPoints: net, answerLabel: data.bet ? "No answer" : "No stake" });
  },
};

// ───────────────────────── chain (word chain vs bot) ─────────────────────────
const chain: RoundHandler = {
  initState: () => ({ data: { used: [] as string[], last: "", turns: 0, score: 0, turnStartedAt: 0 } }),
  act(round, state, action, ctx) {
    const data = state.data as { used: string[]; last: string; turns: number; score: number; turnStartedAt: number };
    const sd = round.secret.data as { start: string; turnSec: number; minLen: number; categoryId?: string };
    if (!data.last) {
      data.last = sd.start;
      data.used.push(sd.start);
      data.turnStartedAt = state.startedAt;
    }
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: data.turns > 0, fixedPoints: data.score });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty" };
    const word = normalize(v).replace(/ /g, "");
    const turnLimit = Math.max(5, sd.turnSec - Math.floor(data.turns / 3)) * 1000 + 1500; // grace for latency
    const need = data.last.slice(-1);
    let reason: string | null = null;
    if (ctx.now - data.turnStartedAt > turnLimit) reason = "too slow";
    else if (!word.startsWith(need)) reason = `must start with “${need.toUpperCase()}”`;
    else if (data.used.includes(word)) reason = "already used";
    else if (word.length < sd.minLen + Math.floor(data.turns / 4)) reason = `needs at least ${sd.minLen + Math.floor(data.turns / 4)} letters`;
    else if (sd.categoryId) {
      const cat = CATEGORY_BY_ID.get(sd.categoryId)!;
      const e = resolveAnswer(cat, v);
      if (!e || normalize(e.name).replace(/ /g, "") !== word) reason = `not a known ${cat.label.toLowerCase()} answer`;
    } else if (!isDictionaryWord(word)) reason = "not in the dictionary";
    if (reason) {
      finish(round, state, ctx, { correct: data.turns > 0, fixedPoints: data.score, answerLabel: `${data.turns} words` });
      return { feedback: { accepted: false, reason } };
    }
    data.used.push(word);
    data.turns++;
    data.score += 10 + Math.max(0, word.length - 4) * 3 + Math.floor(data.turns / 3) * 5;
    const bot = sd.categoryId ? botCategoryWord(sd.categoryId, word.slice(-1), data.used) : botWord(word.slice(-1), data.used, data.turns);
    if (!bot) {
      finish(round, state, ctx, { correct: true, fixedPoints: data.score + 50, answerLabel: `${data.turns} words — bot gave up!` });
      return { feedback: { accepted: true, botGaveUp: true, score: data.score + 50 } };
    }
    data.used.push(bot);
    data.last = bot;
    data.turnStartedAt = ctx.now;
    const nextLimit = Math.max(5, sd.turnSec - Math.floor(data.turns / 3));
    return { feedback: { accepted: true, bot, score: data.score, turnSec: nextLimit, minLen: sd.minLen + Math.floor(data.turns / 4) } };
  },
  timeout(round, state, ctx) {
    const data = state.data as { score: number; turns: number };
    finish(round, state, ctx, { correct: data.turns > 0, fixedPoints: data.score ?? 0, answerLabel: `${data.turns ?? 0} words` });
  },
};

function botCategoryWord(categoryId: string, letter: string, used: string[]): string | null {
  const cat = CATEGORY_BY_ID.get(categoryId)!;
  const opts = cat.entries
    .map((e) => normalize(e.name).replace(/ /g, ""))
    .filter((w) => w.startsWith(letter) && !used.includes(w) && /^[a-z]+$/.test(w));
  if (!opts.length) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

// ───────────────────────── memory ─────────────────────────
const memory: RoundHandler = {
  act(round, state, action, ctx) {
    if (action.type === "ready") {
      if (state.data.readyAt) return { error: "already" };
      state.data.readyAt = ctx.now;
      return { reveal: { prompt: round.secret.data?.question, options: round.secret.data?.options } };
    }
    if (action.type !== "answer") return { error: "unsupported" };
    if (!state.data.readyAt) return { error: "still studying" };
    const opts = round.secret.data?.options as { id: string; label: string }[];
    const id = typeof action.value === "string" ? action.value : "";
    if (!opts.some((o) => o.id === id)) return { error: "invalid option" };
    const correct = id === round.secret.correctOptionId;
    finish(round, state, ctx, { correct, from: state.data.readyAt as number, answerLabel: opts.find((o) => o.id === id)?.label });
    return { feedback: { correct } };
  },
};

// ───────────────────────── letters (Word Forge) ─────────────────────────
function letterCounts(w: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of w) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

export function fitsLetters(word: string, letters: string): boolean {
  const have = letterCounts(letters);
  for (const [ch, n] of letterCounts(word)) if ((have.get(ch) ?? 0) < n) return false;
  return true;
}

const letters: RoundHandler = {
  initState: () => ({ data: { tries: 0 } }),
  act(round, state, action, ctx) {
    if (action.type === "give-up") {
      finish(round, state, ctx, { correct: false });
      return {};
    }
    if (action.type !== "answer") return { error: "unsupported" };
    const v = str(action.value);
    if (!v) return { error: "empty" };
    const word = compact(v);
    const sd = round.secret.data as { letters: string; best: number; minLen: number };
    const prior = (state.data.tries as number) ?? 0;
    // Shape mistakes are free to retry; only a dictionary miss costs a try.
    if (word.length < sd.minLen) return { feedback: { valid: false, reason: `at least ${sd.minLen} letters`, attemptsLeft: 3 - prior } };
    if (!fitsLetters(word, sd.letters)) return { feedback: { valid: false, reason: "uses letters you don't have", attemptsLeft: 3 - prior } };
    const tries = prior + 1;
    state.data.tries = tries;
    const reason = isDictionaryWord(word) ? null : "not in the dictionary";
    if (reason) {
      if (tries >= 3) {
        finish(round, state, ctx, { correct: false, answerLabel: v });
        return { feedback: { valid: false, reason, attemptsLeft: 0 } };
      }
      return { feedback: { valid: false, reason, attemptsLeft: 3 - tries } };
    }
    const q = Math.min(1, word.length / sd.best);
    finish(round, state, ctx, { correct: q >= 0.6, quality: q, answerLabel: word.toUpperCase() });
    return { feedback: { valid: true, length: word.length, best: sd.best } };
  },
};

export const HANDLERS: Record<RoundKind, RoundHandler> = { choice, text, number, clues, reveal, order, groups, multi, rare, sort, map, wager, chain, memory, letters };

export function newPlayerState(round: Round, now: number): PlayerRoundState {
  const base: PlayerRoundState = { startedAt: now, cluesUsed: 0, attempts: [], done: false, correct: false, quality: 0, points: 0, data: {} };
  const init = HANDLERS[round.handler].initState?.(round) ?? {};
  return { ...base, ...init, data: { ...base.data, ...(init.data ?? {}) } };
}

export async function applyAction(round: Round, state: PlayerRoundState, action: Action, ctx: ActContext): Promise<ActResult> {
  if (state.done) return { error: "round already answered" };
  return HANDLERS[round.handler].act(round, state, action, ctx);
}

export function applyTimeout(round: Round, state: PlayerRoundState, ctx: ActContext): void {
  if (state.done) return;
  const h = HANDLERS[round.handler];
  if (h.timeout) h.timeout(round, state, ctx);
  else finish(round, state, ctx, { correct: false });
}
