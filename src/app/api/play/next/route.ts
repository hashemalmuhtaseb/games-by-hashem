import { route, z, json } from "@/lib/api";
import { getSession, nextRound } from "@/server/solo";

export const POST = route({ name: "play.next", schema: z.object({ sessionId: z.string().max(64) }), limit: [40, 2] }, async ({ id, body }) => {
  const s = getSession(body.sessionId, id.player.id);
  if (!s) return json({ error: "Session expired — start a new game." }, 404);
  return { view: await nextRound(s) };
});
