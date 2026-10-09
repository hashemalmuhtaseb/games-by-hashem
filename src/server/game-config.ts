import { z } from "zod";
import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import type { ScoringConfig } from "@/engine/types";

export const ScoringOverrideSchema = z
  .object({
    base: z.number().int().min(10).max(1000),
    speedBonus: z.number().int().min(0).max(500),
    streakStep: z.number().min(0).max(1),
    streakCap: z.number().min(0).max(3),
    cluePenalty: z.number().min(0).max(1),
    wrongAttemptPenalty: z.number().min(0).max(1),
    minCorrectPoints: z.number().int().min(0).max(100),
  })
  .partial();

export const GameConfigSchema = z.object({ scoring: ScoringOverrideSchema.optional() });

interface Cfg {
  enabled: boolean;
  scoring: Partial<ScoringConfig>;
}

const cache = singleton("gameConfig", () => ({ at: 0, map: new Map<string, Cfg>() }));

export async function gameConfig(slug: string): Promise<Cfg> {
  if (Date.now() - cache.at > 30_000) {
    const rows = await db.game.findMany();
    cache.map = new Map(
      rows.map((r) => {
        const parsed = GameConfigSchema.safeParse(r.config);
        return [r.slug, { enabled: r.enabled, scoring: parsed.success ? parsed.data.scoring ?? {} : {} }];
      }),
    );
    cache.at = Date.now();
  }
  return cache.map.get(slug) ?? { enabled: true, scoring: {} };
}

export function invalidateGameConfig() {
  cache.at = 0;
}
