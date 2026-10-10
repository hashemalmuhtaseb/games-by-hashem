import { route, z } from "@/lib/api";
import { nextRound, startSession } from "@/server/solo";
import { MAX_STARTING_CHIPS, MIN_STARTING_CHIPS } from "@/engine/chips";

const Body = z.object({
  game: z.string().min(1).max(40),
  modes: z.array(z.string().max(60)).max(30).optional(),
  variant: z.enum(["classic", "survival", "ranked", "daily", "chaos"]).default("classic"),
  startingChips: z.number().int().min(MIN_STARTING_CHIPS).max(MAX_STARTING_CHIPS).optional(),
});

export const POST = route({ name: "play.start", schema: Body, limit: [20, 0.5] }, async ({ id, body }) => {
  const s = await startSession({ playerId: id.player.id, gameSlug: body.game, modes: body.modes, variant: body.variant, startingChips: body.startingChips });
  const view = await nextRound(s);
  return { sessionId: s.id, view };
});
