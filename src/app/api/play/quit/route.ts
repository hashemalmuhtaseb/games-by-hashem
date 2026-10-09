import { route, z, json } from "@/lib/api";
import { getSession, quitSession } from "@/server/solo";

export const POST = route({ name: "play.quit", schema: z.object({ sessionId: z.string().max(64) }), limit: [20, 1] }, async ({ id, body }) => {
  const s = getSession(body.sessionId, id.player.id);
  if (!s) return json({ error: "Session expired." }, 404);
  return { summary: await quitSession(s) };
});
