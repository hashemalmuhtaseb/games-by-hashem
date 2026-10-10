import { describe, expect, it } from "vitest";
import { CATEGORY_BY_ID, firstLetter, resolveDetailed } from "@/content/categories";
import { MemoryRarityStore, priors, rarityFor, answerKey } from "@/engine/rarity";
import { HANDLERS, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import type { ActContext, Round } from "@/engine/types";

const foot = CATEGORY_BY_ID.get("footballers")!;
const res = (input: string, letter?: string) => resolveDetailed(foot, input, letter);
const name = (input: string, letter?: string) => {
  const r = res(input, letter);
  return r.status === "exact" || r.status === "corrected" ? r.entry.name : null;
};

describe("football player recognition", () => {
  it("accepts Marcos Rojo in every common form", () => {
    for (const v of ["Marcos Rojo", "marcos rojo", "MARCOS ROJO", "Rojo, Marcos", "  Marcos   Rojo "]) expect(name(v, "M"), v).toBe("Marcos Rojo");
  });

  it("corrects Marcus Rojo to Marcos Rojo and says so", () => {
    const r = res("Marcus Rojo", "M");
    expect(r.status).toBe("corrected");
    expect(r.status === "corrected" && r.entry.name).toBe("Marcos Rojo");
  });

  it("recognises well-known and less famous players", () => {
    expect(name("Mohamed Salah", "M")).toBe("Mohamed Salah");
    expect(name("Mo Salah")).toBe("Mohamed Salah");
    expect(name("Manuel Neuer", "M")).toBe("Manuel Neuer");
    expect(name("Marcus Rashford", "M")).toBe("Marcus Rashford");
    expect(name("Jesse Lingard")).toBe("Jesse Lingard");
    expect(name("Harry Maguire")).toBe("Harry Maguire");
  });

  it("handles accents both ways", () => {
    expect(name("Kylian Mbappe")).toBe("Kylian Mbappé");
    expect(name("Luka Modric")).toBe("Luka Modrić");
    expect(name("Pele")).toBe("Pelé");
  });

  it("knows retired and historic players", () => {
    expect(name("Zinedine Zidane")).toBe("Zinedine Zidane");
    expect(name("Ferenc Puskas")).toBe("Ferenc Puskás");
    expect(name("Bobby Charlton")).toBe("Bobby Charlton");
    expect(name("Just Fontaine")).toBe("Just Fontaine");
  });

  it("accepts a surname only when one player clearly owns it", () => {
    expect(name("Salah")).toBe("Mohamed Salah");
    expect(name("Neuer")).toBe("Manuel Neuer");
    // Many players share a common surname: ask instead of guessing.
    expect(res("Hernandez").status).toBe("suggest");
    expect(res("Smith").status).toBe("suggest");
  });

  it("does not merge different people", () => {
    // Close but different names must never silently resolve to someone else.
    const r = res("Marco Rossi");
    if (r.status === "exact") expect(r.entry.name).toBe("Marco Rossi");
    else expect(r.status).not.toBe("corrected");
  });

  it("rejects invented players with a reason", () => {
    const r = res("Zzyzx Qwertyuiop");
    expect(r.status).toBe("none");
    expect(r.status === "none" && r.reason).toMatch(/couldn.t find/);
  });

  it("applies the letter rule to the first word of the display name and explains misses", () => {
    expect(firstLetter("Mohamed Salah")).toBe("M");
    expect(firstLetter("Mesut Özil")).toBe("M");
    expect(firstLetter("Özil")).toBe("O");
    const r = res("Lionel Messi", "M");
    expect(r.status).toBe("none");
    expect(r.status === "none" && r.reason).toMatch(/starts with L, not M/);
  });

  it("knows a big, verified list", () => {
    expect(foot.entries.length).toBeGreaterThan(100_000);
  });
});

describe("rarity scoring", () => {
  const store = new MemoryRarityStore();
  const pts = async (n: string) => {
    const e = foot.entries.find((x) => x.name === n)!;
    return rarityFor(foot, e, await store.stats(foot.id)).points;
  };

  it("orders famous < moderately known < obscure", async () => {
    const messi = await pts("Lionel Messi");
    const ronaldo = await pts("Cristiano Ronaldo");
    const rashford = await pts("Marcus Rashford");
    const rojo = await pts("Marcos Rojo");
    const obscure = foot.entries.filter((e) => e.fame !== undefined && e.fame <= 5)[0];
    const obscurePts = rarityFor(foot, obscure, await store.stats(foot.id)).points;
    expect(messi).toBeLessThanOrEqual(20);
    expect(ronaldo).toBeLessThanOrEqual(20);
    expect(rashford).toBeGreaterThan(messi);
    expect(rojo).toBeGreaterThan(rashford);
    expect(obscurePts).toBeGreaterThanOrEqual(90);
    expect(rojo).toBeLessThan(obscurePts);
  });

  it("never gives an unknown-to-the-curated-list answer the maximum just for being missing", () => {
    const pr = priors(foot);
    const rojo = foot.entries.find((x) => x.name === "Marcos Rojo")!;
    expect(pr.get(answerKey(rojo))).toBeGreaterThan(0);
  });

  it("scores the same answer the same way under the same data", async () => {
    expect(await pts("Marcos Rojo")).toBe(await pts("Marcos Rojo"));
  });

  it("learns from answers with smoothing: one vote barely moves, many votes do", async () => {
    const s = new MemoryRarityStore();
    const e = foot.entries.find((x) => x.name === "Marcos Rojo")!;
    const before = rarityFor(foot, e, await s.stats(foot.id)).points;
    await s.record(foot.id, e, "p1");
    const one = rarityFor(foot, e, await s.stats(foot.id)).points;
    expect(Math.abs(before - one)).toBeLessThan(25);
    for (let i = 2; i < 200; i++) await s.record(foot.id, e, `p${i}`);
    const many = rarityFor(foot, e, await s.stats(foot.id)).points;
    expect(many).toBeLessThan(one);
    // The same player can't farm it.
    expect(await s.record(foot.id, e, "p1")).toBe(false);
  });
});

describe("Rare Words round handler", () => {
  const ctx = (): ActContext => ({ now: Date.now() + 2000, streak: 0, playerId: "p1", scoring: mergeScoring(), services: { rarity: new MemoryRarityStore() } });
  const round = (letter?: string): Round => ({
    gameSlug: "rare-words",
    handler: "rare",
    contentKey: "rare:footballers",
    subjectKey: "x",
    topic: "rare/footballers",
    difficulty: 2,
    pub: { kind: "rare", gameSlug: "rare-words", mode: "footballers", modeLabel: "x", prompt: "x", timeLimitSec: 25, topic: "x", difficulty: 2 },
    secret: { answerLabel: "any", data: { categoryId: "footballers", letter } },
  });

  it("accepts Marcus Rojo as Marcos Rojo for M and scores it", async () => {
    const r = round("M");
    const st = newPlayerState(r, Date.now());
    const out = await HANDLERS.rare.act(r, st, { type: "answer", value: "Marcus Rojo" }, ctx());
    expect(out.feedback).toMatchObject({ valid: true, canonical: "Marcos Rojo", corrected: "Marcus Rojo" });
    expect(st.done).toBe(true);
    expect(st.points).toBeGreaterThan(0);
  });

  it("asks which player is meant instead of rejecting an ambiguous answer", async () => {
    const r = round();
    const st = newPlayerState(r, Date.now());
    const out = await HANDLERS.rare.act(r, st, { type: "answer", value: "Hernandez" }, ctx());
    expect(out.feedback?.valid).toBeNull();
    expect((out.feedback?.suggest as string[]).length).toBeGreaterThan(1);
    expect(st.done).toBe(false);
  });

  it("rejects invented answers with a reason and a penalty", async () => {
    const r = round();
    const st = newPlayerState(r, Date.now());
    const out = await HANDLERS.rare.act(r, st, { type: "answer", value: "Zzyzx Qwertyuiop" }, ctx());
    expect(out.feedback).toMatchObject({ valid: false });
    expect(out.feedback?.reason).toBeTruthy();
    expect(st.points).toBe(-10);
  });
});

describe("other categories", () => {
  const cat = (id: string) => CATEGORY_BY_ID.get(id)!;
  const ok = (id: string, v: string) => {
    const r = resolveDetailed(cat(id), v);
    return r.status === "exact" || r.status === "corrected" ? r.entry.name : null;
  };
  it("handles plurals, articles and spacing for things", () => {
    expect(ok("animals", "Lions")).toBe(ok("animals", "lion"));
    expect(ok("countries", "the netherlands")).toBeTruthy();
    expect(ok("cities", "new york")).toBeTruthy();
  });
  it("rejects nonsense", () => {
    expect(ok("animals", "Blorptastic")).toBeNull();
  });
});
