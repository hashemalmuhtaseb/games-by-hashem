import { describe, expect, it } from "vitest";
import { fingerprint, similarity, validateDraft } from "@/content/pipeline/validate";
import { factsProvider, parseDrafts, anthropicProvider } from "@/content/pipeline/providers";
import { setCustomQuestions } from "@/content/custom";
import { communityMode } from "@/engine/games/community";
import { createRng } from "@/engine/rng";
import { applyAction, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import { MemoryRarityStore } from "@/engine/rarity";

const good = { question: "Which planet is known as the Red Planet?", correct: "Mars", wrong: ["Venus", "Jupiter", "Mercury"], explanation: "Iron oxide gives Mars its colour." };

describe("draft validation", () => {
  it("accepts a well-formed question", () => {
    const v = validateDraft(good, []);
    expect(v.reasons).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("rejects malformed and giveaway drafts", () => {
    expect(validateDraft({ ...good, wrong: ["Venus", "Venus", "Mercury"] }, []).reasons).toContain("options are not distinct");
    expect(validateDraft({ ...good, wrong: ["Venus", "Jupiter"] }, []).ok).toBe(false);
    expect(validateDraft({ ...good, question: "Mars is called the Red Planet: which planet is it?" }, []).reasons).toContain("the question contains its own answer");
    expect(validateDraft({ ...good, wrong: ["Venus", "Jupiter", "None of the above"] }, []).ok).toBe(false);
    expect(validateDraft({ ...good, explanation: "what the fuck" }, []).reasons).toContain("contains blocked language");
  });

  it("catches near-duplicates regardless of word order", () => {
    const fp = fingerprint(good);
    const v = validateDraft({ ...good, question: "Known as the Red Planet, which planet is it?" }, [{ key: "custom:a", fingerprint: fp }]);
    expect(v.ok).toBe(false);
    expect(v.duplicateOf).toBe("custom:a");
    expect(similarity(fp, fingerprint({ question: "Who painted the Mona Lisa?", correct: "Leonardo da Vinci" }))).toBeLessThan(0.2);
  });
});

describe("providers", () => {
  it("facts provider produces valid, verified drafts without any API key", async () => {
    for (const topic of factsProvider.topics) {
      const drafts = await factsProvider.generate({ topic, count: 12, difficulty: 2, seed: topic });
      expect(drafts.length, topic).toBeGreaterThanOrEqual(8);
      const seen: { key: string; fingerprint: string }[] = [];
      let ok = 0;
      for (const d of drafts) {
        const v = validateDraft(d, seen);
        if (v.ok) {
          ok++;
          seen.push({ key: String(ok), fingerprint: v.fingerprint! });
        } else expect(v.reasons.join(), `${topic}: ${d.question}`).toMatch(/near-duplicate/);
      }
      expect(ok, topic).toBeGreaterThan(0);
    }
  });

  it("AI providers stay off without configuration", () => {
    const prev = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    expect(anthropicProvider.unavailableReason()).toMatch(/AI_PROVIDER/);
    process.env.AI_PROVIDER = prev;
  });

  it("parses JSON arrays out of chatty model replies", () => {
    const text = 'Sure! Here you go:\n```json\n[{"question":"Q?","correct":"A","wrong":["B","C","D"]}]\n```';
    expect(parseDrafts(text)).toHaveLength(1);
    expect(() => parseDrafts("no json here")).toThrow();
  });
});

describe("community mode", () => {
  it("serves published custom questions as playable choice rounds", async () => {
    setCustomQuestions([{ key: "custom:t1", topic: "space", difficulty: 2, origin: "admin", prompt: good }]);
    const mode = communityMode("roulette");
    expect(mode.unavailableReason!()).toBeNull();
    const [c] = mode.candidates();
    const r = await mode.build(c, { rng: createRng("x"), media: { flag: () => "" } });
    expect(JSON.stringify(r.pub)).not.toContain("correct");
    expect(r.pub.options).toHaveLength(4);
    const st = newPlayerState(r, Date.now());
    await applyAction(r, st, { type: "answer", value: r.secret.correctOptionId! }, { now: Date.now() + 1000, streak: 0, playerId: "p", scoring: mergeScoring(), services: { rarity: new MemoryRarityStore() } });
    expect(st.correct).toBe(true);
    setCustomQuestions([]);
    expect(mode.unavailableReason!()).toMatch(/No reviewed/);
  });
});

describe("game master", async () => {
  const { classicLine, gameMasterLine } = await import("@/server/game-master");
  const rng = createRng("gm");
  it("calls lone geniuses, wipe-outs, streaks and lead changes", () => {
    const base = { type: "reveal" as const, answer: "Peru", round: 3, total: 10, correct: [] as string[], wrong: [] as string[] };
    expect(classicLine({ ...base, wrong: ["A", "B"] }, rng)).toMatch(/Peru/);
    expect(classicLine({ ...base, correct: ["Ana"], wrong: ["B", "C"] }, rng)).toMatch(/Ana/);
    expect(classicLine({ ...base, correct: ["Ana", "Bo"], streak: { name: "Ana", n: 5 }, newLeader: true, leader: { name: "Ana", score: 900 } }, rng)).toMatch(/Ana/);
    expect(classicLine({ type: "final", winner: "Ana", tie: false, margin: 20, top: [{ name: "Ana", score: 500 }, { name: "Bo", score: 480 }] }, rng)).toMatch(/whisker/);
  });
  it("stays quiet when off and falls back to the classic host without an AI provider", async () => {
    const ev = { type: "start" as const, game: "Quickfire", mode: "classic", players: ["Ana", "Bo"], rounds: 10 };
    expect(await gameMasterLine("off", ev, rng)).toBeNull();
    expect(await gameMasterLine("ai", ev, rng)).toMatch(/🎙️/);
  });
});
