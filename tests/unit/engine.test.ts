import { describe, expect, it } from "vitest";
import { allGames } from "@/engine/registry";
import { createRng } from "@/engine/rng";
import { gameCandidates } from "@/engine/selection";
import { applyAction, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import { MemoryRarityStore } from "@/engine/rarity";
import { compact } from "@/engine/normalize";
import { COUNTRIES } from "@/content/datasets/countries";
import { CATEGORY_BY_ID, entryLetter as firstLetterOf } from "@/content/categories";
import type { ActContext, Action, Round } from "@/engine/types";

const media = { flag: (iso: string) => `/api/media/opaque-${Math.random().toString(36).slice(2)}` };
const ctx = (): ActContext => ({ now: Date.now() + 2000, streak: 0, playerId: "p1", scoring: mergeScoring(), services: { rarity: new MemoryRarityStore() }, balance: 1000 });

/** A sequence of actions that should complete the round correctly. */
async function correctActions(r: Round): Promise<Action[] | null> {
  const sd = r.secret.data as Record<string, unknown> | undefined;
  switch (r.handler) {
    case "groups":
      return r.secret.groups!.map((g) => ({ type: "answer", value: g.ids }));
    case "sort":
      return [{ type: "answer", value: (sd as { buckets: Record<string, number> }).buckets }];
    case "map": {
      const c = COUNTRIES.find((x) => x.iso2 === (sd as { iso2: string }).iso2)!;
      return [{ type: "answer", value: c.name }];
    }
    case "wager":
      return [{ type: "bet", value: 20 }, { type: "answer", value: r.secret.correctOptionId! }];
    case "memory":
      return [{ type: "ready" }, { type: "answer", value: r.secret.correctOptionId! }];
    case "multi": {
      const target = r.pub.input?.target ?? 5;
      let names: string[];
      if (sd?.accept) names = (sd.accept as { name: string }[]).map((a) => a.name);
      else {
        const cat = CATEGORY_BY_ID.get(sd!.categoryId as string)!;
        names = cat.entries.filter((e) => !sd!.letter || firstLetterOf(e) === sd!.letter).map((e) => e.name);
      }
      return names.slice(0, target).map((n) => ({ type: "answer", value: n }));
    }
    case "rare": {
      const cat = CATEGORY_BY_ID.get(sd!.categoryId as string)!;
      const e = cat.entries.find((x) => !sd!.letter || firstLetterOf(x) === sd!.letter)!;
      return [{ type: "answer", value: e.name }];
    }
    case "letters":
      return [{ type: "answer", value: r.secret.answerLabel.toLowerCase() }];
    case "case":
      return [{ type: "answer", value: r.pub.options ? r.secret.correctOptionId! : r.secret.accept![0] }];
    case "investigate":
      return [{ type: "clue", value: "symptoms" }, { type: "answer", value: r.secret.correctOptionId! }];
    default: {
      const a = await correctAction(r);
      return a ? [a as Action] : null;
    }
  }
}

async function correctAction(r: Round) {
  switch (r.handler) {
    case "choice":
      return { type: "answer", value: r.secret.correctOptionId } as const;
    case "text":
    case "clues":
    case "reveal":
      return { type: "answer", value: r.pub.options ? r.secret.correctOptionId : r.secret.accept![0] } as const;
    case "number":
      return { type: "answer", value: r.secret.numeric!.value } as const;
    case "order":
      return { type: "answer", value: r.secret.order } as const;
    default:
      return null;
  }
}

describe("every game mode builds valid, leak-free rounds", () => {
  for (const game of allGames()) {
    for (const mode of game.modes) {
      if (mode.unavailableReason?.()) continue;
      it(`${game.slug} / ${mode.id}`, async () => {
        const cands = gameCandidates(game, [mode.id]);
        expect(cands.length, "has candidates").toBeGreaterThan(0);
        const rng = createRng(`${game.slug}-${mode.id}`);
        const picks = Array.from({ length: Math.min(25, cands.length) }, () => cands[Math.floor(rng() * cands.length)]);
        let built = 0;
        for (const c of picks) {
          let r: Round;
          try {
            r = await mode.build(c, { rng, media });
          } catch (e) {
            if (String(e).includes("skip-kind")) continue;
            throw e;
          }
          built++;
          expect(r.contentKey).toBe(c.key);
          const pubJson = JSON.stringify(r.pub);
          expect(pubJson).not.toMatch(/"(correct|accept|answer|secret)"/);
          if (r.pub.options) {
            const labels = r.pub.options.map((o) => o.label + (o.media && "url" in o.media ? o.media.url : ""));
            expect(new Set(labels).size, `duplicate options in ${r.contentKey}`).toBe(labels.length);
            if (r.secret.correctOptionId) expect(r.pub.options.some((o) => o.id === r.secret.correctOptionId)).toBe(true);
          }
          if ((r.handler === "text" || r.handler === "clues") && !r.pub.options) {
            const ans = compact(r.secret.answerLabel);
            // Check each visible string on its own: concatenating JSON keys and values can spell words by accident.
            const strings: string[] = [r.pub.prompt];
            JSON.stringify([r.pub.media ?? [], r.pub.extra ?? {}], (_k, v) => (typeof v === "string" && strings.push(v), v));
            if (ans.length > 3) for (const s of strings) expect(compact(s).includes(ans), `answer leaked in ${r.contentKey}: ${s}`).toBe(false);
          }
          const actions = await correctActions(r);
          if (actions) {
            const st = newPlayerState(r, Date.now());
            for (const action of actions) {
              const res = await applyAction(r, st, action, ctx());
              expect(res.error, `${r.contentKey}: ${res.error}`).toBeUndefined();
            }
            expect(st.done && st.correct, `correct answer accepted for ${r.contentKey}`).toBe(true);
            expect(st.points).toBeGreaterThan(0);
          }
        }
        expect(built).toBeGreaterThan(0);
      });
    }
  }
});
