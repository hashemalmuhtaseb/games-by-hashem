import { describe, expect, it } from "vitest";
import { FOOTBALLERS, MANAGERS, CLUBS, WORLD_CUPS, UCL_WINNERS } from "@/content/datasets/football";
import { MOVIES } from "@/content/datasets/movies";
import { SONGS } from "@/content/datasets/songs";
import { CELEBRITIES } from "@/content/datasets/celebrities";
import { COUNTRIES } from "@/content/datasets/countries";
import { compact } from "@/engine/normalize";

/** Structural integrity checks for the hand-curated datasets. Facts are reviewed by hand; these catch typos. */
const THIS_YEAR = new Date().getUTCFullYear();

function uniqueIds(list: { id: string }[]) {
  const ids = list.map((x) => x.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("datasets", () => {
  it("footballers are well formed", () => {
    uniqueIds(FOOTBALLERS);
    const names = new Set<string>();
    for (const p of FOOTBALLERS) {
      expect(names.has(compact(p.name)), p.name).toBe(false);
      names.add(compact(p.name));
      expect(p.clubs.length, p.name).toBeGreaterThan(0);
      // A club may appear twice (players return, e.g. Ronaldo to Manchester United), but never back to back.
      p.clubs.forEach((c, i) => expect(c, `${p.name} lists ${c} twice in a row`).not.toBe(p.clubs[i - 1]));
      expect(p.born).toBeGreaterThan(1900);
      expect(p.born).toBeLessThan(THIS_YEAR - 15);
      expect(p.difficulty).toBeGreaterThanOrEqual(1);
      expect(p.difficulty).toBeLessThanOrEqual(5);
      for (const y of p.worldCup ?? []) expect(WORLD_CUPS.some((w) => w.year === y), `${p.name} WC ${y}`).toBe(true);
      for (const y of p.ballonDor ?? []) {
        expect(y).toBeGreaterThan(1955);
        expect(y - p.born, `${p.name} Ballon d'Or age`).toBeGreaterThan(17);
      }
      if (p.fact) expect(compact(p.fact).includes(compact(p.name)), `${p.name} fact names them`).toBe(false);
    }
  });

  it("no Ballon d'Or year is awarded twice", () => {
    const years = FOOTBALLERS.flatMap((p) => p.ballonDor ?? []);
    expect(new Set(years).size).toBe(years.length);
  });

  it("World Cup and Champions League records are ordered and unique", () => {
    for (const list of [WORLD_CUPS, UCL_WINNERS]) {
      const years = list.map((x) => x.year);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
      expect(new Set(years).size).toBe(years.length);
      for (const x of list) expect(x.winner).not.toBe(x.runnerUp);
    }
  });

  it("managers and clubs are well formed", () => {
    uniqueIds(MANAGERS);
    uniqueIds(CLUBS);
    for (const m of MANAGERS) {
      expect(m.teams.length).toBeGreaterThan(0);
      expect(compact(m.fact).includes(compact(m.name)), m.name).toBe(false);
    }
    for (const c of CLUBS) {
      expect(c.founded).toBeGreaterThan(1850);
      expect(c.founded).toBeLessThan(THIS_YEAR);
    }
  });

  it("movies are well formed", () => {
    uniqueIds(MOVIES);
    for (const m of MOVIES) {
      expect(m.year).toBeGreaterThan(1900);
      expect(m.year).toBeLessThanOrEqual(THIS_YEAR);
      expect(m.stars.length).toBeGreaterThan(0);
      expect(compact(m.plot).includes(compact(m.title)) && compact(m.title).length > 4, `${m.title} plot names it`).toBe(false);
    }
  });

  it("songs are well formed", () => {
    uniqueIds(SONGS);
    for (const s of SONGS) {
      if (s.year) {
        expect(s.year).toBeGreaterThan(1920);
        expect(s.year).toBeLessThanOrEqual(THIS_YEAR);
      }
      expect(compact(s.description).includes(compact(s.title)) && compact(s.title).length > 4, `${s.title} description names it`).toBe(false);
    }
  });

  it("celebrities' clues never name them", () => {
    uniqueIds(CELEBRITIES);
    for (const c of CELEBRITIES) {
      expect(c.clues.length).toBeGreaterThanOrEqual(3);
      const last = compact(c.name.split(" ").slice(-1)[0]);
      for (const clue of c.clues) expect(compact(clue).includes(compact(c.name)), `${c.name}: ${clue}`).toBe(false);
      if (last.length > 3) for (const clue of c.clues) expect(compact(clue).includes(last), `${c.name}: ${clue}`).toBe(false);
      if (c.died) expect(c.died).toBeGreaterThan(c.born);
    }
  });

  it("countries have the fields games depend on", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    for (const c of COUNTRIES) {
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
      expect(c.name.length).toBeGreaterThan(1);
    }
  });
});
