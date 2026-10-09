import { db } from "@/lib/db";
import { levelForXp } from "@/engine/scoring";

export const ACHIEVEMENTS = [
  { slug: "first-game", name: "Welcome Aboard", description: "Finish your first game.", icon: "🎉" },
  { slug: "streak-5", name: "On Fire", description: "Answer 5 in a row correctly.", icon: "🔥" },
  { slug: "streak-10", name: "Unstoppable", description: "Answer 10 in a row correctly.", icon: "☄️" },
  { slug: "perfect", name: "Flawless", description: "Get every round right in a game of 8+ rounds.", icon: "💯" },
  { slug: "rare-hunter", name: "Rare Hunter", description: "Score 90+ rarity points with one answer.", icon: "💎" },
  { slug: "explorer", name: "Explorer", description: "Play 8 different games.", icon: "🧭" },
  { slug: "globetrotter", name: "Globetrotter", description: "Get 50 flag rounds right.", icon: "🌍" },
  { slug: "cinephile", name: "Cinephile", description: "Get 50 movie rounds right.", icon: "🍿" },
  { slug: "pundit", name: "Pundit", description: "Get 50 football rounds right.", icon: "⚽" },
  { slug: "daily-done", name: "Daily Devotee", description: "Complete a Daily Challenge.", icon: "📅" },
  { slug: "party-host", name: "Party Starter", description: "Host a multiplayer game.", icon: "🥳" },
  { slug: "winner", name: "Champion", description: "Win a multiplayer game.", icon: "🏆" },
  { slug: "survivor", name: "Survivor", description: "Reach round 15 in Survival.", icon: "🛡️" },
  { slug: "level-10", name: "Seasoned", description: "Reach level 10.", icon: "⭐" },
] as const;

export async function ensureAchievements() {
  await db.achievement.createMany({ data: ACHIEVEMENTS.map((a) => ({ ...a })), skipDuplicates: true });
}

export interface GameResultInput {
  playerId: string;
  gameSlug: string;
  points: number;
  rounds: number;
  correct: number;
  bestStreak: number;
  won?: boolean;
  variant?: string;
  maxRarity?: number;
  survivedRounds?: number;
  hosted?: boolean;
  /** per-round quality values for adaptive difficulty */
  qualities: number[];
}

export interface ProgressResult {
  xpGained: number;
  level: number;
  leveledUp: boolean;
  newAchievements: { slug: string; name: string; icon: string }[];
  personalBest: boolean;
}

/** Updates profile XP/level, per-game stats (incl. adaptive skill), and unlocks achievements. */
export async function applyGameResult(r: GameResultInput): Promise<ProgressResult> {
  const xpGained = Math.max(5, Math.round(r.points / 10) + r.correct * 3 + (r.won ? 50 : 0));
  const profile = await db.profile.upsert({ where: { playerId: r.playerId }, create: { playerId: r.playerId }, update: {} });
  const newXp = profile.xp + xpGained;
  const level = levelForXp(newXp);
  await db.profile.update({
    where: { playerId: r.playerId },
    data: {
      xp: newXp,
      level,
      gamesPlayed: { increment: 1 },
      roundsPlayed: { increment: r.rounds },
      correctAnswers: { increment: r.correct },
      wins: r.won ? { increment: 1 } : undefined,
      bestStreak: Math.max(profile.bestStreak, r.bestStreak),
    },
  });
  const stat = await db.playerGameStat.findUnique({ where: { playerId_gameSlug: { playerId: r.playerId, gameSlug: r.gameSlug } } });
  let skill = stat?.skill ?? 0.5;
  for (const q of r.qualities) skill = skill * 0.85 + q * 0.15;
  const personalBest = !stat || r.points > stat.bestScore;
  await db.playerGameStat.upsert({
    where: { playerId_gameSlug: { playerId: r.playerId, gameSlug: r.gameSlug } },
    create: { playerId: r.playerId, gameSlug: r.gameSlug, plays: 1, rounds: r.rounds, correct: r.correct, bestScore: r.points, skill },
    update: { plays: { increment: 1 }, rounds: { increment: r.rounds }, correct: { increment: r.correct }, bestScore: Math.max(stat?.bestScore ?? 0, r.points), skill },
  });

  // Achievements
  const have = new Set((await db.playerAchievement.findMany({ where: { playerId: r.playerId }, select: { achievementSlug: true } })).map((a) => a.achievementSlug));
  const earn: string[] = [];
  const add = (s: string, cond: boolean) => cond && !have.has(s) && earn.push(s);
  add("first-game", true);
  add("streak-5", r.bestStreak >= 5);
  add("streak-10", r.bestStreak >= 10);
  add("perfect", r.rounds >= 8 && r.correct === r.rounds);
  add("rare-hunter", (r.maxRarity ?? 0) >= 90);
  add("daily-done", r.variant === "daily");
  add("party-host", !!r.hosted);
  add("winner", !!r.won);
  add("survivor", (r.survivedRounds ?? 0) >= 15);
  add("level-10", level >= 10);
  if (!have.has("explorer") || !have.has("globetrotter") || !have.has("cinephile") || !have.has("pundit")) {
    const stats = await db.playerGameStat.findMany({ where: { playerId: r.playerId } });
    add("explorer", stats.length >= 8);
    add("globetrotter", (stats.find((s) => s.gameSlug === "flags")?.correct ?? 0) >= 50);
    add("cinephile", (stats.find((s) => s.gameSlug === "movies")?.correct ?? 0) >= 50);
    add("pundit", (stats.find((s) => s.gameSlug === "football")?.correct ?? 0) >= 50);
  }
  if (earn.length) {
    await ensureAchievements();
    await db.playerAchievement.createMany({ data: earn.map((s) => ({ playerId: r.playerId, achievementSlug: s })), skipDuplicates: true });
  }
  return {
    xpGained,
    level,
    leveledUp: level > profile.level,
    newAchievements: earn.map((s) => {
      const a = ACHIEVEMENTS.find((x) => x.slug === s)!;
      return { slug: a.slug, name: a.name, icon: a.icon };
    }),
    personalBest,
  };
}

export async function getSkill(playerIds: string[], gameSlug: string): Promise<number> {
  const rows = await db.playerGameStat.findMany({ where: { playerId: { in: playerIds }, gameSlug } });
  if (!rows.length) return 0.45;
  return rows.reduce((s, r) => s + r.skill, 0) / rows.length;
}

/** Elo-style rating update for ranked play. Solo: performance vs a par of 0.6 quality. */
export async function updateRating(playerId: string, board: string, performance: number, opponents: number[] = []) {
  const row = await db.rating.upsert({ where: { playerId_board: { playerId, board } }, create: { playerId, board }, update: {} });
  const K = row.games < 10 ? 40 : 24;
  let delta: number;
  if (opponents.length) {
    // performance = fraction of opponents beaten (ties count half)
    const expected = opponents.reduce((s, o) => s + 1 / (1 + 10 ** ((o - row.rating) / 400)), 0) / opponents.length;
    delta = Math.round(K * (performance - expected));
  } else {
    const expected = 1 / (1 + 10 ** ((1000 - row.rating) / 400));
    delta = Math.round(K * (performance - expected * 0.6) * 1.5);
  }
  const updated = await db.rating.update({ where: { playerId_board: { playerId, board } }, data: { rating: Math.max(100, row.rating + delta), games: { increment: 1 } } });
  return { rating: updated.rating, delta };
}

export async function trackEvent(type: string, playerId: string | null, gameSlug: string | null, meta: Record<string, unknown> = {}) {
  try {
    await db.analyticsEvent.create({ data: { type, playerId, gameSlug, meta: meta as object } });
  } catch {
    /* analytics must never break gameplay */
  }
}
