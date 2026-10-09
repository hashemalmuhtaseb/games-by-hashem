import { db } from "@/lib/db";
import { xpForLevel } from "@/engine/scoring";
import { ACHIEVEMENTS } from "./progress";

export async function publicProfile(playerId: string, self = false) {
  const p = await db.player.findUnique({
    where: { id: playerId },
    include: { profile: true, achievements: true, gameStats: { orderBy: { plays: "desc" } }, ratings: true, user: { select: { username: true, createdAt: true, role: true } } },
  });
  if (!p) return null;
  const level = p.profile?.level ?? 1;
  const recent = await db.score.findMany({ where: { playerId }, orderBy: { match: { startedAt: "desc" } }, take: 12, include: { match: { select: { gameSlug: true, mode: true, startedAt: true } } } });
  return {
    id: p.id,
    displayName: p.displayName,
    avatar: p.avatar,
    color: p.color,
    isGuest: p.isGuest,
    username: p.user?.username ?? null,
    role: self ? p.user?.role ?? null : undefined,
    joined: (p.user?.createdAt ?? p.createdAt).toISOString(),
    level,
    xp: p.profile?.xp ?? 0,
    xpLevelStart: xpForLevel(level),
    xpNextLevel: xpForLevel(level + 1),
    wins: p.profile?.wins ?? 0,
    gamesPlayed: p.profile?.gamesPlayed ?? 0,
    roundsPlayed: p.profile?.roundsPlayed ?? 0,
    correctAnswers: p.profile?.correctAnswers ?? 0,
    bestStreak: p.profile?.bestStreak ?? 0,
    bio: p.profile?.bio ?? "",
    favoriteCategories: p.profile?.favoriteCategories ?? [],
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: p.achievements.find((x) => x.achievementSlug === a.slug)?.unlockedAt.toISOString() ?? null })),
    games: p.gameStats.map((g) => ({ slug: g.gameSlug, plays: g.plays, rounds: g.rounds, correct: g.correct, bestScore: g.bestScore, skill: Math.round(g.skill * 100) })),
    ratings: p.ratings.map((r) => ({ board: r.board, rating: r.rating, games: r.games })),
    recent: recent.map((r) => ({ game: r.match.gameSlug, mode: r.match.mode, points: r.points, rank: r.rank, correct: r.correct, rounds: r.rounds, at: r.match.startedAt.toISOString() })),
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof publicProfile>>>;
