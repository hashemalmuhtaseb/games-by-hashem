import { BALLON_DOR, CLUBS, FOOTBALLERS, FOOTBALLER_BY_ID, MANAGERS, UCL_WINNERS, WORLD_CUPS, worldCupTitles, type Footballer } from "@/content/datasets/football";
import { choiceRound, cluesRound, decadeOf, pickDistinct, textRound } from "../build";
import { pick, sample, shuffle } from "../rng";
import type { BuildContext, Candidate, GameDefinition, ModeDefinition } from "../types";

const SLUG = "football";
const SRC = "Football data: public record, reference date 2025-08 (start of 2025/26).";

function names(p: Footballer): string[] {
  return [p.name, ...(p.aliases ?? [])];
}

function cand(mode: string, p: Footballer, bump = 0): Candidate {
  return { key: `fb:${mode}:${p.id}`, subject: `player:${p.id}`, topic: `football/${p.legend ? "legends" : "players"}`, difficulty: Math.max(1, Math.min(5, p.difficulty + bump)), mode, gameSlug: SLUG, ref: p.id };
}

function similarPlayers(ctx: BuildContext, p: Footballer, n: number): Footballer[] {
  const same = FOOTBALLERS.filter((x) => x.id !== p.id && x.position === p.position && !!x.legend === !!p.legend);
  const pool = same.length >= n ? same : FOOTBALLERS.filter((x) => x.id !== p.id);
  return pickDistinct(ctx.rng, pool, n, (x) => x.name);
}

function uniqueClubs(p: Footballer): string[] {
  return [...new Set(p.clubs)];
}

export function playerClues(p: Footballer): string[] {
  const clues: string[] = [];
  clues.push(`I'm a ${p.position.toLowerCase()} born in the ${decadeOf(p.born)}.`);
  clues.push(`I represent ${p.nationality} internationally.`);
  const clubs = uniqueClubs(p);
  if (clubs.length > 1) clues.push(`One of my clubs was ${clubs[Math.floor(clubs.length / 2)]}.`);
  if (p.worldCup?.length) clues.push(`I've won the World Cup (${p.worldCup.join(", ")}).`);
  else if (p.ucl) clues.push(`I've won the Champions League ${p.ucl === 1 ? "once" : `${p.ucl} times`}.`);
  else if (p.continental) clues.push(`I won the ${p.continental}.`);
  if (p.ballonDor?.length) clues.push(`I won the Ballon d'Or in ${p.ballonDor.join(", ")}.`);
  if (p.fact) clues.push(p.fact);
  clues.push(`My career path: ${p.clubs.join(" → ")}.`);
  return clues;
}

const career: ModeDefinition = {
  id: "career",
  kinds: ["choice", "text"],
  label: "Career path",
  description: "Name the player from their club history.",
  candidates: () => FOOTBALLERS.filter((p) => uniqueClubs(p).length >= 2).map((p) => cand("career", p)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    const media = [{ type: "timeline" as const, title: "Senior clubs", items: p.clubs }];
    const explanation = `${p.name} (${p.nationality}, ${p.position.toLowerCase()}).`;
    if (c.difficulty >= 3 && !ctx.preferChoice)
      return textRound({ c, modeLabel: "Career path", prompt: "Whose career is this?", media, timeLimitSec: ctx.timeLimitSec ?? 25, accept: names(p), answerLabel: p.name, placeholder: "Player name…", suggest: "footballers", explanation, source: SRC });
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Career path", prompt: "Whose career is this?", media, timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: similarPlayers(ctx, p, 3).map((x) => ({ label: x.name })), explanation, source: SRC });
  },
};

const clubs: ModeDefinition = {
  id: "clubs",
  kinds: ["choice"],
  label: "Three clubs",
  description: "Which player has played for all three of these clubs?",
  candidates: () => FOOTBALLERS.filter((p) => uniqueClubs(p).length >= 3).map((p) => cand("clubs", p, 1)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    const three = sample(ctx.rng, uniqueClubs(p), 3);
    // Distractors must NOT have played for all three clubs.
    const ds = pickDistinct(ctx.rng, FOOTBALLERS.filter((x) => x.id !== p.id && !three.every((cl) => x.clubs.includes(cl))), 3, (x) => x.name);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Three clubs", prompt: "Who has played for all three of these clubs?", media: [{ type: "words", items: three }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: ds.map((x) => ({ label: x.name })), explanation: `${p.name}: ${p.clubs.join(" → ")}`, source: SRC });
  },
};

const natpos: ModeDefinition = {
  id: "natpos",
  kinds: ["choice"],
  label: "Nationality & position",
  description: "Nationality, position and era — who fits?",
  candidates: () => FOOTBALLERS.map((p) => cand("natpos", p, 1)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    const ds = pickDistinct(ctx.rng, FOOTBALLERS.filter((x) => x.id !== p.id && (x.nationality !== p.nationality || x.position !== p.position)), 3, (x) => x.name);
    return choiceRound({
      c, rng: ctx.rng, modeLabel: "Nationality & position", prompt: "Which player matches all of these?",
      media: [{ type: "facts", items: [{ label: "Nationality", value: p.nationality }, { label: "Position", value: p.position }, { label: "Born", value: decadeOf(p.born) }, { label: "Status", value: p.legend ? "Retired" : "Active (2025)" }] }],
      timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: ds.map((x) => ({ label: x.name, sub: x.nationality })),
      explanation: `${p.name} — ${p.nationality}, ${p.position}, born ${p.born}.`, source: SRC,
    });
  },
};

const trophies: ModeDefinition = {
  id: "trophies",
  kinds: ["choice"],
  label: "Trophy cabinet",
  description: "Identify the player from their major honours.",
  candidates: () => FOOTBALLERS.filter((p) => p.worldCup?.length || p.ballonDor?.length || (p.ucl ?? 0) >= 2).map((p) => cand("trophies", p, 1)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    const items: { label: string; value: string }[] = [];
    if (p.worldCup?.length) items.push({ label: "World Cup", value: p.worldCup.join(", ") });
    if (p.ucl) items.push({ label: "Champions League / European Cup", value: `${p.ucl}×` });
    if (p.ballonDor?.length) items.push({ label: "Ballon d'Or", value: p.ballonDor.join(", ") });
    if (p.continental) items.push({ label: "Continental", value: p.continental });
    items.push({ label: "Position", value: p.position });
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Trophy cabinet", prompt: "Whose trophy cabinet is this?", media: [{ type: "facts", items }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: similarPlayers(ctx, p, 3).map((x) => ({ label: x.name })), explanation: `${p.name}.`, source: SRC });
  },
};

const teammates: ModeDefinition = {
  id: "teammates",
  kinds: ["choice"],
  label: "Famous teammates",
  description: "Who shared a dressing room with these stars?",
  candidates: () => FOOTBALLERS.filter((p) => p.teammates).map((p) => cand("teammates", p, 1)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    const t = p.teammates!;
    const ds = pickDistinct(ctx.rng, FOOTBALLERS.filter((x) => x.id !== p.id && !x.clubs.includes(t.club) && !t.names.includes(x.name)), 3, (x) => x.name);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Famous teammates", prompt: `Who played alongside these stars at ${t.club}?`, media: [{ type: "words", items: t.names }], timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: p.name }, distractors: ds.map((x) => ({ label: x.name })), explanation: `${p.name} played with ${t.names.join(", ")} at ${t.club}.`, source: SRC });
  },
};

const legend: ModeDefinition = {
  id: "legend",
  kinds: ["clues"],
  label: "Who am I? (legends)",
  description: "Clues reveal one at a time. Fewer clues = more points.",
  candidates: () => FOOTBALLERS.map((p) => cand("legend", p, 0)),
  build(c, ctx) {
    const p = FOOTBALLER_BY_ID.get(c.ref)!;
    return cluesRound({ c, modeLabel: "Who am I?", prompt: "Who am I?", suggest: "footballers", clues: playerClues(p), accept: names(p), answerLabel: p.name, timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `${p.name} — ${p.clubs.join(" → ")}`, source: SRC });
  },
};

const club: ModeDefinition = {
  id: "club",
  kinds: ["clues"],
  label: "Guess the club",
  description: "City, colours, nickname, founding year — name the club.",
  candidates: () => CLUBS.map((cl) => ({ key: `fb:club:${cl.id}`, subject: `club:${cl.id}`, topic: "football/clubs", difficulty: cl.difficulty + 1, mode: "club", gameSlug: SLUG, ref: cl.id })),
  build(c, ctx) {
    const cl = CLUBS.find((x) => x.id === c.ref)!;
    return cluesRound({
      c, modeLabel: "Guess the club", prompt: "Which club is this?", suggest: "clubs",
      clues: [`Founded in ${cl.founded}.`, `Club colours: ${cl.colors}.`, `Based in ${cl.country}.`, `Nickname: ${cl.nickname}.`, `Home city: ${cl.city}.`, `Home ground: ${cl.stadium}.`],
      accept: [cl.name, ...(cl.aliases ?? [])], answerLabel: cl.name, timeLimitSec: ctx.timeLimitSec ?? 40, explanation: `${cl.name} — ${cl.stadium}, ${cl.city}.`, source: SRC,
    });
  },
};

const stadium: ModeDefinition = {
  id: "stadium",
  kinds: ["choice"],
  label: "Stadium",
  description: "Whose home ground is this?",
  candidates: () => CLUBS.map((cl) => ({ key: `fb:stadium:${cl.id}`, subject: `club:${cl.id}`, topic: "football/stadiums", difficulty: cl.difficulty + 1, mode: "stadium", gameSlug: SLUG, ref: cl.id })),
  build(c, ctx) {
    const cl = CLUBS.find((x) => x.id === c.ref)!;
    // Stadiums shared by two clubs (San Siro, King Abdullah Sports City) exclude the co-tenant.
    const ds = pickDistinct(ctx.rng, CLUBS.filter((x) => x.stadium !== cl.stadium), 3, (x) => x.name);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Stadium", prompt: `Which club plays its home games at ${cl.stadium}?`, timeLimitSec: ctx.timeLimitSec ?? 15, correct: { label: cl.name }, distractors: ds.map((x) => ({ label: x.name })), explanation: `${cl.stadium} is in ${cl.city} — home of ${cl.name}.`, source: SRC });
  },
};

const manager: ModeDefinition = {
  id: "manager",
  kinds: ["clues"],
  label: "Guess the manager",
  description: "Name the coach from the teams they've managed.",
  candidates: () => MANAGERS.map((m) => ({ key: `fb:manager:${m.id}`, subject: `manager:${m.id}`, topic: "football/managers", difficulty: m.difficulty + 1, mode: "manager", gameSlug: SLUG, ref: m.id })),
  build(c, ctx) {
    const m = MANAGERS.find((x) => x.id === c.ref)!;
    const teams = [...new Set(m.teams)];
    return cluesRound({
      c, modeLabel: "Guess the manager", prompt: "Which manager is this?", suggest: "managers",
      clues: [`I'm from ${m.nationality}.`, `I've managed ${teams.length} different team${teams.length > 1 ? "s" : ""}.`, m.fact, `Teams managed: ${teams.join(", ")}.`],
      accept: [m.name, ...(m.aliases ?? [])], answerLabel: m.name, timeLimitSec: ctx.timeLimitSec ?? 35, explanation: `${m.name}: ${m.teams.join(" → ")}`, source: SRC,
    });
  },
};

type Stat = { id: string; label: string; value: (p: Footballer) => number | undefined };
const STATS: Stat[] = [
  { id: "ucl", label: "Champions League / European Cup titles", value: (p) => p.ucl },
  { id: "bdo", label: "Ballon d'Or wins", value: (p) => p.ballonDor?.length ?? (p.ucl !== undefined ? 0 : undefined) },
  { id: "born", label: "year of birth (who is younger?)", value: (p) => p.born },
];

const higherLower: ModeDefinition = {
  id: "higherlower",
  kinds: ["choice"],
  label: "Higher or lower",
  description: "Two players, one stat. Who has more?",
  candidates: () => STATS.flatMap((s) => Array.from({ length: 60 }, (_, i) => ({ key: `fb:hl:${s.id}:${i}`, subject: `fbhl:${s.id}:${i}`, topic: "football/stats", difficulty: 2 + (i % 3), mode: "higherlower", gameSlug: SLUG, ref: `${s.id}:${i}` }))),
  build(c, ctx) {
    const stat = STATS.find((s) => s.id === c.ref.split(":")[0])!;
    const pool = FOOTBALLERS.filter((p) => stat.value(p) !== undefined);
    let a: Footballer, b: Footballer;
    let guard = 0;
    do {
      [a, b] = sample(ctx.rng, pool, 2);
    } while (stat.value(a) === stat.value(b) && guard++ < 50);
    const va = stat.value(a)!;
    const vb = stat.value(b)!;
    const younger = stat.id === "born";
    const winner = younger ? (va > vb ? a : b) : va > vb ? a : b;
    const prompt = younger ? "Who is younger?" : `Who has more ${stat.label}?`;
    const fmt = (p: Footballer) => (younger ? `born ${p.born}` : `${stat.value(p)}`);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Higher or lower", prompt, timeLimitSec: ctx.timeLimitSec ?? 10, correct: { label: winner.name }, distractors: [{ label: (winner === a ? b : a).name }], explanation: `${a.name}: ${fmt(a)} · ${b.name}: ${fmt(b)}`, source: SRC });
  },
};

const worldCup: ModeDefinition = {
  id: "worldcup",
  kinds: ["choice"],
  label: "World Cup history",
  description: "Winners and hosts of every men's World Cup.",
  candidates: () => WORLD_CUPS.flatMap((w) => [
    { key: `fb:wc:winner:${w.year}`, subject: `wc:${w.year}`, topic: "football/worldcup", difficulty: w.year >= 1990 ? 2 : 4, mode: "worldcup", gameSlug: SLUG, ref: `winner:${w.year}` },
    { key: `fb:wc:host:${w.year}`, subject: `wc:${w.year}`, topic: "football/worldcup", difficulty: w.year >= 1990 ? 2 : 4, mode: "worldcup", gameSlug: SLUG, ref: `host:${w.year}` },
  ]),
  build(c, ctx) {
    const [kind, y] = c.ref.split(":");
    const w = WORLD_CUPS.find((x) => x.year === Number(y))!;
    const nations = [...new Set(WORLD_CUPS.flatMap((x) => [x.winner, x.runnerUp, x.host]))].filter((n) => !n.includes("&"));
    const right = kind === "winner" ? w.winner : w.host;
    const ds = pickDistinct(ctx.rng, nations.filter((n) => n !== right && n !== (kind === "winner" ? w.runnerUp : "")), 2, (x) => x);
    const distract = kind === "winner" ? [w.runnerUp, ...ds] : ds.concat(pick(ctx.rng, nations.filter((n) => n !== right && !ds.includes(n))));
    return choiceRound({ c, rng: ctx.rng, modeLabel: "World Cup history", prompt: kind === "winner" ? `Who won the ${w.year} World Cup?` : `Which country hosted the ${w.year} World Cup?`, timeLimitSec: ctx.timeLimitSec ?? 12, correct: { label: right }, distractors: distract.slice(0, 3).map((x) => ({ label: x })), explanation: `${w.year}: hosted by ${w.host}; ${w.winner} beat ${w.runnerUp} in the final.`, source: "FIFA World Cup records" });
  },
};

const ucl: ModeDefinition = {
  id: "ucl",
  kinds: ["choice"],
  label: "Champions League winners",
  description: "Who lifted the trophy that year?",
  candidates: () => UCL_WINNERS.map((u) => ({ key: `fb:ucl:${u.year}`, subject: `ucl:${u.year}`, topic: "football/ucl", difficulty: u.year >= 2010 ? 2 : 3, mode: "ucl", gameSlug: SLUG, ref: String(u.year) })),
  build(c, ctx) {
    const u = UCL_WINNERS.find((x) => x.year === Number(c.ref))!;
    const clubsPool = [...new Set(UCL_WINNERS.flatMap((x) => [x.winner, x.runnerUp]))];
    const ds = [u.runnerUp, ...pickDistinct(ctx.rng, clubsPool.filter((x) => x !== u.winner && x !== u.runnerUp), 2, (x) => x)];
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Champions League winners", prompt: `Who won the ${u.year - 1}–${String(u.year).slice(2)} Champions League final?`, timeLimitSec: ctx.timeLimitSec ?? 12, correct: { label: u.winner }, distractors: ds.map((x) => ({ label: x })), explanation: `${u.year} final: ${u.winner} beat ${u.runnerUp}.`, source: "UEFA records" });
  },
};

const ballonDor: ModeDefinition = {
  id: "ballondor",
  kinds: ["choice"],
  label: "Ballon d'Or",
  description: "Who won football's most famous individual award?",
  candidates: () => BALLON_DOR.map((b) => ({ key: `fb:bdo:${b.year}`, subject: `bdo:${b.year}`, topic: "football/awards", difficulty: b.year >= 2008 ? 2 : 4, mode: "ballondor", gameSlug: SLUG, ref: String(b.year) })),
  build(c, ctx) {
    const b = BALLON_DOR.find((x) => x.year === Number(c.ref))!;
    const winners = [...new Set(BALLON_DOR.map((x) => x.winner))];
    const ds = pickDistinct(ctx.rng, winners.filter((w) => w !== b.winner), 3, (x) => x);
    return choiceRound({ c, rng: ctx.rng, modeLabel: "Ballon d'Or", prompt: `Who won the ${b.year} Ballon d'Or?`, timeLimitSec: ctx.timeLimitSec ?? 12, correct: { label: b.winner }, distractors: ds.map((x) => ({ label: x })), explanation: `${b.winner} won the Ballon d'Or in ${b.year}.`, source: "France Football records" });
  },
};

const wcTitles: ModeDefinition = {
  id: "wctitles",
  kinds: ["choice"],
  label: "World Cup titles",
  description: "Which nation has won the World Cup more often?",
  candidates: () => Array.from({ length: 30 }, (_, i) => ({ key: `fb:wctitles:${i}`, subject: `wctitles:${i}`, topic: "football/worldcup", difficulty: 3, mode: "wctitles", gameSlug: SLUG, ref: String(i) })),
  build(c, ctx) {
    const titles = [...worldCupTitles().entries()];
    let a: [string, number], b: [string, number];
    do [a, b] = sample(ctx.rng, titles, 2);
    while (a[1] === b[1]);
    const win = a[1] > b[1] ? a : b;
    return choiceRound({ c, rng: ctx.rng, modeLabel: "World Cup titles", prompt: "Which nation has won more men's World Cups?", timeLimitSec: ctx.timeLimitSec ?? 10, correct: { label: win[0] }, distractors: [{ label: (win === a ? b : a)[0] }], explanation: `${a[0]}: ${a[1]} · ${b[0]}: ${b[1]} (West Germany counted with Germany).`, source: "FIFA World Cup records" });
  },
};

const silhouette: ModeDefinition = {
  id: "silhouette",
  kinds: ["choice"],
  label: "Silhouette",
  description: "Requires licensed player photos.",
  unavailableReason: () => "Player photos need a licensed image source (e.g. Wikimedia Commons with attribution). Not bundled.",
  candidates: () => [],
  build: () => {
    throw new Error("no licensed photos");
  },
};

export const footballGame: GameDefinition = {
  slug: SLUG,
  name: "Guess the Football Player",
  short: "Career paths, trophies, teammates, clubs, stadiums, managers and World Cup history.",
  icon: "⚽",
  accent: ["#22c55e", "#0ea5e9"],
  group: "sports",
  rules: ["Identify the player, club or manager from the clues.", "Club histories list senior clubs (loans included where notable).", "Data reference date: August 2025. Questions only ever say 'played for', never 'plays for'."],
  modes: [career, clubs, natpos, trophies, teammates, legend, club, stadium, manager, higherLower, worldCup, ucl, ballonDor, wcTitles, silhouette],
  rounds: 10,
  timeLimitSec: 15,
  multiplayer: true,
};

export { shuffle };
