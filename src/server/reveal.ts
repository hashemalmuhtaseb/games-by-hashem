import { CATEGORY_BY_ID, entryLetter } from "@/content/categories";
import { priors, posterior, pointsFromProbability, answerKey } from "@/engine/rarity";
import type { EngineServices, RevealPayload, Round } from "@/engine/types";

/** What the player sees once a round is over. Only now are answers disclosed. */
export async function buildReveal(round: Round, services: EngineServices, answers?: { answerKey?: string | null; label?: string }[]): Promise<RevealPayload> {
  const s = round.secret;
  const out: RevealPayload = {
    answerLabel: s.answerLabel,
    contentKey: round.contentKey,
    correctOptionId: s.correctOptionId,
    order: s.order,
    groups: s.groups,
    explanation: s.explanation,
    source: s.source,
  };
  if (round.handler === "rare" || (round.handler === "multi" && s.data?.categoryId)) {
    const cat = CATEGORY_BY_ID.get(s.data!.categoryId as string)!;
    const letter = s.data?.letter as string | undefined;
    const stats = await services.rarity.stats(cat.id);
    const pr = priors(cat);
    const eligible = cat.entries.filter((e) => !letter || entryLetter(e) === letter);
    const scored = eligible.map((e) => {
      const k = answerKey(e);
      const p = posterior(pr.get(k) ?? 0, stats.counts.get(k) ?? 0, stats.total, cat.priorStrength);
      return { name: e.name, p, points: pointsFromProbability(p, cat.rarityScale), tier: e.tier, fame: e.fame };
    });
    scored.sort((a, b) => b.p - a.p);
    // Rare ideas should still be recognisable: for fame-ranked lists, skip the deepest obscurities.
    const rare = scored.filter((x) => x.tier >= 3 && (x.fame === undefined || x.fame >= 25));
    const pickRare = rare.length ? [rare[Math.floor(Math.random() * rare.length)], rare[Math.floor(Math.random() * rare.length)], rare[Math.floor(Math.random() * rare.length)]] : [];
    const noun = cat.noun ?? `${cat.label.toLowerCase()} answer`;
    out.answerLabel = letter ? `Any valid ${noun} starting with ${letter}` : `Any valid ${noun}`;
    if (cat.source) out.source = cat.source;
    if (letter && cat.letterRule) out.explanation = `${out.explanation ? out.explanation + " " : ""}${cat.letterRule}`;
    out.extra = {
      mostCommon: scored.slice(0, 6).map((x) => ({ name: x.name, points: x.points, percent: Math.round(x.p * 1000) / 10 })),
      rareIdeas: [...new Map(pickRare.map((x) => [x.name, x])).values()].map((x) => ({ name: x.name, points: x.points })),
      validCount: eligible.length,
      observedAnswers: stats.total,
      answers: answers ?? [],
    };
  }
  if (round.handler === "multi" && s.data?.accept) {
    out.extra = { ...(out.extra ?? {}), validExamples: (s.data.accept as { name: string }[]).slice(0, 12).map((a) => a.name), validCount: (s.data.accept as unknown[]).length };
  }
  if (round.handler === "map") out.extra = { country: s.answerLabel };
  if (round.handler === "memory" || round.handler === "wager") out.extra = { options: s.data?.options, question: s.data?.question };
  if (round.handler === "chain") out.extra = {};
  if (s.numeric) out.extra = { ...(out.extra ?? {}), value: s.numeric.value, unit: s.numeric.unit };
  return out;
}
