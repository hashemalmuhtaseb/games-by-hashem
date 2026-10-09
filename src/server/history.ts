import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import type { HistoryView } from "@/engine/selection";

const LOOKBACK_DAYS = 180;

/** Loads what these players have already seen (union for multiplayer rooms). */
export async function loadHistory(playerIds: string[]): Promise<HistoryView> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000);
  const rows = await db.playerQuestionHistory.findMany({
    where: { playerId: { in: playerIds }, seenAt: { gte: since } },
    select: { contentKey: true, subjectKey: true, seenAt: true },
    orderBy: { seenAt: "desc" },
    take: 20_000,
  });
  const contentLastSeen = new Map<string, number>();
  const subjectLastSeen = new Map<string, number>();
  for (const r of rows) {
    const t = r.seenAt.getTime();
    if ((contentLastSeen.get(r.contentKey) ?? 0) < t) contentLastSeen.set(r.contentKey, t);
    if ((subjectLastSeen.get(r.subjectKey) ?? 0) < t) subjectLastSeen.set(r.subjectKey, t);
  }
  return { contentLastSeen, subjectLastSeen };
}

export async function recordSeen(rows: { playerId: string; gameSlug: string; contentKey: string; subjectKey: string; topic: string; roomCode?: string }[]) {
  if (!rows.length) return;
  await db.playerQuestionHistory.createMany({ data: rows });
}

const excludedCache = singleton("excludedCache", () => ({ at: 0, keys: new Set<string>() }));

/** Retired/rejected questions and anything reported by 3+ different players are never served. */
export async function excludedKeys(): Promise<Set<string>> {
  if (Date.now() - excludedCache.at < 60_000) return excludedCache.keys;
  const rows = await db.question.findMany({
    where: { OR: [{ status: { in: ["RETIRED", "REJECTED"] } }, { reportCount: { gte: 3 } }] },
    select: { contentKey: true },
  });
  excludedCache.keys = new Set(rows.map((r) => r.contentKey));
  excludedCache.at = Date.now();
  return excludedCache.keys;
}

export function invalidateExcluded() {
  excludedCache.at = 0;
}
