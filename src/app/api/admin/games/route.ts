import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import { catalog } from "@/server/catalog";
import { GameConfigSchema, invalidateGameConfig } from "@/server/game-config";
import { trackEvent } from "@/server/progress";
import { mergeScoring } from "@/engine/scoring";

export const GET = route({ name: "admin-games", staff: true, limit: [60, 2] }, async () => {
  const rows = new Map((await db.game.findMany()).map((g) => [g.slug, g]));
  return {
    defaults: mergeScoring(),
    games: catalog().map((g) => ({
      slug: g.slug,
      name: g.name,
      icon: g.icon,
      questionCount: g.questionCount,
      modes: g.modes.map((m) => ({ id: m.id, label: m.label, available: m.available, reason: m.reason })),
      enabled: rows.get(g.slug)?.enabled ?? true,
      config: rows.get(g.slug)?.config ?? {},
    })),
  };
});

const Patch = z.object({ slug: z.string().max(40), enabled: z.boolean().optional(), config: GameConfigSchema.optional() });

export const PATCH = route({ name: "admin-games-update", admin: true, schema: Patch, limit: [30, 0.5] }, async ({ id, body }) => {
  const g = catalog().find((x) => x.slug === body.slug);
  if (!g) return { error: "Unknown game." };
  await db.game.upsert({
    where: { slug: g.slug },
    create: { slug: g.slug, name: g.name, enabled: body.enabled ?? true, config: body.config ?? {} },
    update: { ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), ...(body.config ? { config: body.config } : {}) },
  });
  invalidateGameConfig();
  await trackEvent("admin_action", id.player.id, g.slug, { action: "game_update", enabled: body.enabled, config: body.config ?? null, by: id.user?.username });
  return { ok: true };
});
