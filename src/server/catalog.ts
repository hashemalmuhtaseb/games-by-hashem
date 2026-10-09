import { allGames, type GameInfo } from "@/engine/registry";
import { gameCandidates, modeCandidates } from "@/engine/selection";
import { singleton } from "@/lib/globals";

/** Client-safe catalogue (no generators, no answers). Cached per process. */
const cached = singleton("catalog", () => ({ list: null as GameInfo[] | null }));

export function invalidateCatalog() {
  cached.list = null;
}

export function catalog(): GameInfo[] {
  return (cached.list ??=
    allGames().map((g) => ({
      slug: g.slug,
      name: g.name,
      short: g.short,
      icon: g.icon,
      accent: g.accent,
      group: g.group,
      original: !!g.original,
      rules: g.rules,
      rounds: g.rounds,
      timeLimitSec: g.timeLimitSec,
      multiplayer: g.multiplayer,
      soloOnly: !!g.soloOnly,
      modes: g.modes.map((m) => {
        const reason = m.unavailableReason?.() ?? undefined;
        return { id: m.id, label: m.label, description: m.description, available: !reason && modeCandidates(g, m).length > 0, reason: reason ?? undefined };
      }),
      questionCount: gameCandidates(g).length,
    })));
}

/** Distinct questions across every game (borrowed modes and mixes share keys, so they count once). */
export function uniqueQuestionCount(slugs?: string[]): number {
  const keys = new Set<string>();
  for (const g of allGames()) {
    if (slugs && !slugs.includes(g.slug)) continue;
    for (const c of gameCandidates(g)) keys.add(c.key);
  }
  return keys.size;
}
