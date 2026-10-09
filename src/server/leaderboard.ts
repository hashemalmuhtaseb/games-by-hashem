import { db } from "@/lib/db";
import { todayKey } from "./solo";

export type Board = "xp" | "wins" | "daily" | "rating" | `game:${string}`;

export async function leaderboard(board: string, limit = 50) {
  if (board === "daily") {
    const rows = await db.dailyResult.findMany({ where: { date: todayKey() }, orderBy: [{ points: "desc" }, { createdAt: "asc" }], take: limit });
    const players = await db.player.findMany({ where: { id: { in: rows.map((r) => r.playerId) } } });
    return rows.map((r, i) => ({ rank: i + 1, player: pick(players.find((p) => p.id === r.playerId)), value: r.points, detail: `${r.correct}/10 correct` }));
  }
  if (board === "rating" || board.startsWith("rating:")) {
    const b = board === "rating" ? "global" : board.slice(7);
    const rows = await db.rating.findMany({ where: { board: b, games: { gte: 1 } }, orderBy: { rating: "desc" }, take: limit, include: { player: true } });
    return rows.map((r, i) => ({ rank: i + 1, player: pick(r.player), value: r.rating, detail: `${r.games} ranked games` }));
  }
  if (board.startsWith("game:")) {
    const slug = board.slice(5);
    const rows = await db.playerGameStat.findMany({ where: { gameSlug: slug, plays: { gte: 1 } }, orderBy: { bestScore: "desc" }, take: limit, include: { player: true } });
    return rows.map((r, i) => ({ rank: i + 1, player: pick(r.player), value: r.bestScore, detail: `${r.plays} plays` }));
  }
  const key = board === "wins" ? "wins" : "xp";
  const rows = await db.profile.findMany({ where: { [key]: { gt: 0 } }, orderBy: { [key]: "desc" }, take: limit, include: { player: true } });
  return rows.map((r, i) => ({ rank: i + 1, player: pick(r.player), value: key === "wins" ? r.wins : r.xp, detail: `Level ${r.level}` }));
}

function pick(p?: { id: string; displayName: string; avatar: string; color: string; isGuest: boolean } | null) {
  return p ? { id: p.id, displayName: p.displayName, avatar: p.avatar, color: p.color, isGuest: p.isGuest } : { id: "?", displayName: "Unknown", avatar: "❔", color: "#666", isGuest: true };
}
