import { route, z, json } from "@/lib/api";
import { act, getSession } from "@/server/solo";

const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), value: z.union([z.string().max(80), z.number(), z.array(z.string().max(40)).max(16), z.record(z.string().max(40), z.number().int().min(0).max(1))]) }),
  z.object({ type: z.literal("hint") }),
  z.object({ type: z.literal("give-up") }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("clue"), value: z.string().max(20) }),
  z.object({ type: z.literal("bet"), value: z.number().max(10_000_000) }),
]);
const Body = z.object({ sessionId: z.string().max(64), roundId: z.string().max(32), action: Action });

export const POST = route({ name: "play.act", schema: Body, limit: [40, 6] }, async ({ id, body }) => {
  const s = getSession(body.sessionId, id.player.id);
  if (!s) return json({ error: "Session expired — start a new game." }, 404);
  return act(s, body.roundId, body.action);
});
