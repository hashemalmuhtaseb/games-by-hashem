import { describe, expect, it } from "vitest";
import { wordForgeGame } from "@/engine/games/originals";
import { createRng } from "@/engine/rng";
import { gameCandidates } from "@/engine/selection";
import { applyAction, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import { MemoryRarityStore } from "@/engine/rarity";
import type { ActContext } from "@/engine/types";

const ctx = (): ActContext => ({ now: Date.now() + 2000, streak: 0, playerId: "p1", scoring: mergeScoring(), services: { rarity: new MemoryRarityStore() }, balance: 1000 });

describe("Word Forge tries", () => {
  it("only dictionary misses cost a try", async () => {
    const mode = wordForgeGame.modes[0];
    const c = gameCandidates(wordForgeGame, [mode.id])[0];
    const r = await mode.build(c, { rng: createRng("forge"), media: { flag: () => "" } });
    const st = newPlayerState(r, Date.now());
    for (let i = 0; i < 5; i++) {
      const res = await applyAction(r, st, { type: "answer", value: "zzzzzz" }, ctx());
      expect(st.done).toBe(false);
      expect((res.feedback as { attemptsLeft: number }).attemptsLeft).toBe(3);
    }
    const letters = (r.secret.data as { letters: string }).letters;
    const junk = letters.slice(0, 4);
    const res = await applyAction(r, st, { type: "answer", value: junk }, ctx());
    if (!st.done) expect((res.feedback as { attemptsLeft: number }).attemptsLeft).toBe(2);
    const win = await applyAction(r, st, { type: "answer", value: r.secret.answerLabel }, ctx());
    if (!st.done) throw new Error("best word not accepted: " + JSON.stringify(win));
    expect(st.correct).toBe(true);
  });
});
