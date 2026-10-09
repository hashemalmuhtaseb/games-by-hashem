import type { GameDefinition, ModeDefinition, RoundKind } from "../types";

/**
 * Builds "proxy" modes that borrow another game's question generator.
 * Content keys are kept, so a flag seen in Trivia Roulette also counts as seen in Guess the Flag.
 */
export function proxyModes(slug: string, sources: GameDefinition[], kinds: RoundKind[] | null, opts: { timeLimitSec?: number; preferChoice?: boolean } = {}): ModeDefinition[] {
  const out: ModeDefinition[] = [];
  for (const g of sources) {
    for (const m of g.modes) {
      if (m.unavailableReason?.()) continue;
      const usable = kinds ? m.kinds.filter((k) => kinds.includes(k)) : m.kinds;
      if (!usable.length) continue;
      out.push({
        id: `${g.slug}.${m.id}`,
        kinds: usable,
        label: `${g.name}: ${m.label}`,
        description: m.description,
        candidates: () => m.candidates().map((c) => ({ ...c, gameSlug: slug, mode: `${g.slug}.${m.id}` })),
        async build(c, ctx) {
          const r = await m.build({ ...c, gameSlug: g.slug, mode: m.id }, { ...ctx, timeLimitSec: opts.timeLimitSec ?? ctx.timeLimitSec, preferChoice: opts.preferChoice || ctx.preferChoice });
          if (kinds && !kinds.includes(r.handler)) throw new Error(`skip-kind:${r.handler}`);
          r.gameSlug = slug;
          r.pub.gameSlug = slug;
          r.pub.modeLabel = `${g.icon} ${g.name} · ${r.pub.modeLabel}`;
          r.pub.extra = { ...(r.pub.extra ?? {}), sourceGame: g.slug };
          return r;
        },
      });
    }
  }
  return out;
}
