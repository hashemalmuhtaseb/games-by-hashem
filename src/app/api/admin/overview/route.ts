import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { roomStats } from "@/server/rooms";
import { catalog } from "@/server/catalog";

const DAY = 86400_000;

export const GET = route({ name: "admin-overview", staff: true, limit: [30, 1] }, async () => {
  const now = Date.now();
  const d1 = new Date(now - DAY);
  const d7 = new Date(now - 7 * DAY);
  const [published, players, accounts, active24, active7, matches24, solo24, rounds24, openReports, openUserReports, pending, retired, perGame, daily] = await Promise.all([
    db.question.count({ where: { status: "PUBLISHED" } }),
    db.player.count(),
    db.user.count(),
    db.player.count({ where: { lastSeenAt: { gte: d1 } } }),
    db.player.count({ where: { lastSeenAt: { gte: d7 } } }),
    db.match.count({ where: { startedAt: { gte: d1 } } }),
    db.analyticsEvent.count({ where: { type: "game_start", at: { gte: d1 } } }),
    db.playerQuestionHistory.count({ where: { seenAt: { gte: d1 } } }),
    db.contentReport.count({ where: { status: "OPEN" } }),
    db.userReport.count({ where: { status: "OPEN" } }),
    db.question.count({ where: { status: "PENDING_REVIEW" } }),
    db.question.count({ where: { status: { in: ["RETIRED", "REJECTED"] } } }),
    db.analyticsEvent.groupBy({ by: ["gameSlug"], where: { type: { in: ["game_start", "room_game_start"] }, at: { gte: d7 } }, _count: { _all: true } }),
    db.$queryRaw<{ day: string; n: bigint }[]>`SELECT to_char(date_trunc('day', "at"), 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS n FROM "AnalyticsEvent" WHERE "type" IN ('game_start','room_game_start') AND "at" >= ${new Date(now - 14 * DAY)} GROUP BY 1 ORDER BY 1`,
  ]);
  const names = new Map(catalog().map((g) => [g.slug, g]));
  return {
    players,
    accounts,
    active24,
    active7,
    gamesStarted24: matches24 + solo24,
    rounds24,
    openReports,
    openUserReports,
    pending,
    retired,
    questions: published,
    live: roomStats(),
    perGame: perGame
      .filter((g) => g.gameSlug)
      .map((g) => ({ slug: g.gameSlug!, name: names.get(g.gameSlug!)?.name ?? g.gameSlug, icon: names.get(g.gameSlug!)?.icon ?? "🎲", plays: g._count._all }))
      .sort((a, b) => b.plays - a.plays),
    daily: daily.map((d) => ({ day: d.day, plays: Number(d.n) })),
  };
});
