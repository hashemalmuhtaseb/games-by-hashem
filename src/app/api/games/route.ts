import { route } from "@/lib/api";
import { catalog } from "@/server/catalog";
import { gameConfig } from "@/server/game-config";
import { refreshCustomContent } from "@/server/custom-content";

export const GET = route({ name: "games", limit: [60, 4] }, async () => {
  await refreshCustomContent().catch(() => undefined);
  const games = await Promise.all(catalog().map(async (g) => ({ ...g, enabled: (await gameConfig(g.slug)).enabled })));
  return { games: games.filter((g) => g.enabled) };
});
