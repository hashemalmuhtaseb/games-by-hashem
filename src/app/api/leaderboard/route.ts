import { route, z } from "@/lib/api";
import { leaderboard } from "@/server/leaderboard";

export const GET = route({ name: "leaderboard", schema: z.object({ board: z.string().max(60).default("xp") }), limit: [30, 2] }, async ({ body }) => ({ rows: await leaderboard(body.board) }));
