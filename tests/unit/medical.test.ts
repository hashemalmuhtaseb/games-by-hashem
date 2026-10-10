import { describe, expect, it } from "vitest";
import { MED_CASES, diagnosisNames } from "@/content/datasets/medical";
import { compact } from "@/engine/normalize";
import { diagnoseGame, mysteryGame, caseSections, isCorrectDiagnosis, mysteryPoints, MYSTERY_BUDGET, MYSTERY_FAST_BONUS, MYSTERY_WRONG_PENALTY } from "@/engine/games/medicine";
import { HANDLERS, newPlayerState } from "@/engine/handlers";
import { createRng } from "@/engine/rng";
import { mergeScoring } from "@/engine/scoring";
import { MemoryRarityStore } from "@/engine/rarity";
import { gameCandidates } from "@/engine/selection";
import type { ActContext, Round } from "@/engine/types";

const media = { flag: () => "/x" };
const ctx = (now = Date.now() + 1000): ActContext => ({ now, streak: 0, playerId: "p1", scoring: mergeScoring(), services: { rarity: new MemoryRarityStore() } });

describe("medical case library", () => {
  it("is large and varied", () => {
    expect(MED_CASES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(MED_CASES.map((c) => c.specialty)).size).toBeGreaterThanOrEqual(12);
    for (const level of [1, 2, 3]) expect(MED_CASES.filter((c) => c.level === level).length).toBeGreaterThanOrEqual(12);
  });

  it("has unique ids and diagnoses", () => {
    expect(new Set(MED_CASES.map((c) => c.id)).size).toBe(MED_CASES.length);
    expect(new Set(MED_CASES.map((c) => compact(c.diagnosis))).size).toBe(MED_CASES.length);
  });

  for (const c of MED_CASES) {
    it(`${c.id}: validated answer, no giveaways`, () => {
      expect(c.explanation.length).toBeGreaterThan(60);
      expect(c.hint.length).toBeGreaterThan(10);
      expect(c.reference.length).toBeGreaterThan(5);
      expect(c.distractors.length).toBeGreaterThanOrEqual(3);
      // The right answer is never also offered as a wrong one.
      for (const d of c.distractors) expect(isCorrectDiagnosis(d, c.id), `${c.id}: distractor ${d}`).toBe(false);
      for (const n of [c.diagnosis, ...c.aliases]) expect(isCorrectDiagnosis(n, c.id), `${c.id}: ${n}`).toBe(true);
      // No clue text names the diagnosis or one of its accepted synonyms.
      const clueText = [c.complaint, ...caseSections(c).flatMap((s) => s.items)].map((t) => ` ${compact(t)} `).join(" ");
      for (const name of [c.diagnosis, ...c.aliases]) {
        const k = compact(name);
        if (k.length >= 5) expect(clueText.includes(k), `${c.id}: clue mentions “${name}”`).toBe(false);
      }
      // The diagnosis is offered in typing suggestions (so advanced mode is fair).
      expect(diagnosisNames()).toContain(c.diagnosis);
    });
  }
});

async function build(game: typeof diagnoseGame, modeId: string, i = 0): Promise<Round> {
  const mode = game.modes.find((m) => m.id === modeId)!;
  const cands = gameCandidates(game, [modeId]);
  return mode.build(cands[i % cands.length], { rng: createRng(`t${i}`), media });
}

describe("free-text diagnosis checking", () => {
  it("never confuses diseases that differ by a letter", () => {
    expect(isCorrectDiagnosis("Hepatitis B", "hep-a")).toBe(false);
    expect(isCorrectDiagnosis("Hepatitis A", "hep-a")).toBe(true);
    expect(isCorrectDiagnosis("Hyperthyroidism", "hypothyroid")).toBe(false);
    expect(isCorrectDiagnosis("hypothyroidism", "hypothyroid")).toBe(true);
    expect(isCorrectDiagnosis("Rubella", "measles")).toBe(false);
  });
  it("forgives clear typos", () => {
    expect(isCorrectDiagnosis("apendicitis", "appendicitis")).toBe(true);
    expect(isCorrectDiagnosis("pnemonia", "pneumonia")).toBe(true);
    expect(isCorrectDiagnosis("Guillain Barre syndrom", "gbs")).toBe(true);
  });
  it("accepts shared synonyms for each case that lists them", () => {
    expect(isCorrectDiagnosis("IBD", "crohns")).toBe(true);
    expect(isCorrectDiagnosis("IBD", "ulcerative-colitis")).toBe(true);
  });
});

describe("Diagnose the Patient", () => {
  it("offers beginner, intermediate and advanced difficulties", () => {
    expect(diagnoseGame.modes.map((m) => m.id)).toEqual(["beginner", "intermediate", "advanced"]);
    for (const m of diagnoseGame.modes) expect(gameCandidates(diagnoseGame, [m.id]).length).toBeGreaterThanOrEqual(12);
  });

  it("multiple choice: right answer scores, wrong scores zero, answer never leaks before reveal", async () => {
    const r = await build(diagnoseGame, "beginner");
    expect(JSON.stringify(r.pub)).not.toContain(r.secret.answerLabel === r.pub.options!.find((o) => o.id === r.secret.correctOptionId)!.label ? "correctOptionId" : "x");
    expect(r.pub.options).toHaveLength(4);
    const ok = newPlayerState(r, Date.now());
    await HANDLERS.case.act(r, ok, { type: "answer", value: r.secret.correctOptionId! }, ctx());
    expect(ok.correct && ok.points > 0).toBe(true);
    const bad = newPlayerState(r, Date.now());
    const wrongId = r.pub.options!.find((o) => o.id !== r.secret.correctOptionId)!.id;
    await HANDLERS.case.act(r, bad, { type: "answer", value: wrongId }, ctx());
    expect(bad.correct).toBe(false);
    expect(bad.points).toBe(0);
  });

  it("hint costs points: same answer, same time, fewer points with the hint", async () => {
    const r = await build(diagnoseGame, "intermediate", 3);
    const now = Date.now();
    const a = newPlayerState(r, now);
    const b = newPlayerState(r, now);
    const hint = await HANDLERS.case.act(r, b, { type: "hint" }, ctx(now + 5000));
    expect(hint.reveal?.hint).toBeTruthy();
    expect((await HANDLERS.case.act(r, b, { type: "hint" }, ctx(now + 5000))).error).toBeTruthy();
    await HANDLERS.case.act(r, a, { type: "answer", value: r.secret.correctOptionId! }, ctx(now + 5000));
    await HANDLERS.case.act(r, b, { type: "answer", value: r.secret.correctOptionId! }, ctx(now + 5000));
    expect(a.points).toBeGreaterThan(b.points);
    expect(b.points).toBeGreaterThan(0);
  });

  it("advanced: accepts the diagnosis and its synonyms as free text", async () => {
    const r = await build(diagnoseGame, "advanced", 1);
    expect(r.pub.options).toBeUndefined();
    for (const name of r.secret.accept!) {
      const st = newPlayerState(r, Date.now());
      await HANDLERS.case.act(r, st, { type: "answer", value: name.toLowerCase() }, ctx());
      expect(st.correct, name).toBe(true);
    }
    const st = newPlayerState(r, Date.now());
    const res = await HANDLERS.case.act(r, st, { type: "answer", value: "definitely not a disease" }, ctx());
    expect(res.feedback).toMatchObject({ correct: false, attemptsLeft: 1 });
  });

  it("faster correct answers score at least as much as slower ones", async () => {
    const r = await build(diagnoseGame, "beginner", 2);
    const now = Date.now();
    const fast = newPlayerState(r, now);
    const slow = newPlayerState(r, now);
    await HANDLERS.case.act(r, fast, { type: "answer", value: r.secret.correctOptionId! }, ctx(now + 3000));
    await HANDLERS.case.act(r, slow, { type: "answer", value: r.secret.correctOptionId! }, ctx(now + 50_000));
    expect(fast.points).toBeGreaterThanOrEqual(slow.points);
  });
});

describe("Medical Mystery", () => {
  it("covers cardiology, neurology, emergency medicine and infectious disease", () => {
    const ids = mysteryGame.modes.map((m) => m.id);
    for (const id of ["cardio", "neuro", "emergency", "infection"]) expect(ids).toContain(id);
  });

  it("starts with only the complaint; clues cost points and reveal their contents", async () => {
    const r = await build(mysteryGame, "all", 5);
    const pubJson = JSON.stringify(r.pub);
    expect(pubJson).not.toContain("sections");
    const st = newPlayerState(r, Date.now());
    const res = await HANDLERS.investigate.act(r, st, { type: "clue", value: "symptoms" }, ctx());
    expect((res.reveal?.items as string[]).length).toBeGreaterThan(0);
    expect(res.feedback).toMatchObject({ spent: 10 });
    expect((await HANDLERS.investigate.act(r, st, { type: "clue", value: "symptoms" }, ctx())).error).toMatch(/Already/);
  });

  it("scores: fewer clues = more points; wrong guesses cost; fast bonus", () => {
    const t = { elapsedMs: 10_000, timeLimitMs: 120_000 };
    expect(mysteryPoints({ correct: true, spent: 10, wrong: 0, cluesUsed: 1, ...t })).toBe(MYSTERY_BUDGET - 10 + MYSTERY_FAST_BONUS);
    expect(mysteryPoints({ correct: true, spent: 55, wrong: 0, cluesUsed: 4, ...t })).toBe(MYSTERY_BUDGET - 55);
    expect(mysteryPoints({ correct: true, spent: 55, wrong: 1, cluesUsed: 4, ...t })).toBe(MYSTERY_BUDGET - 55 - MYSTERY_WRONG_PENALTY);
    expect(mysteryPoints({ correct: true, spent: 10, wrong: 0, cluesUsed: 1, elapsedMs: 100_000, timeLimitMs: 120_000 })).toBe(MYSTERY_BUDGET - 10);
    expect(mysteryPoints({ correct: false, spent: 30, wrong: 3, cluesUsed: 2, ...t })).toBeLessThan(0);
    // Never fewer than 10 for a correct diagnosis.
    expect(mysteryPoints({ correct: true, spent: 100, wrong: 2, cluesUsed: 7, ...t })).toBe(10);
  });

  it("a wrong diagnosis is penalised and can't be guessed twice; three wrong ends the case", async () => {
    const r = await build(mysteryGame, "all", 7);
    const st = newPlayerState(r, Date.now());
    const wrong = r.pub.options!.filter((o) => o.id !== r.secret.correctOptionId);
    const a = await HANDLERS.investigate.act(r, st, { type: "answer", value: wrong[0].id }, ctx());
    expect(a.feedback).toMatchObject({ correct: false, guessesLeft: 2 });
    expect((await HANDLERS.investigate.act(r, st, { type: "answer", value: wrong[0].id }, ctx())).error).toBeTruthy();
    await HANDLERS.investigate.act(r, st, { type: "answer", value: wrong[1].id }, ctx());
    await HANDLERS.investigate.act(r, st, { type: "answer", value: wrong[2].id }, ctx());
    expect(st.done).toBe(true);
    expect(st.points).toBeLessThan(0);
  });
});
