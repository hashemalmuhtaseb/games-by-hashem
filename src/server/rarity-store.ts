import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import { answerKey, type RarityStats, type RarityStore } from "@/engine/rarity";
import type { WordEntry } from "@/content/datasets/wordlists";

const cache = singleton("rarityCache", () => new Map<string, { at: number; stats: RarityStats }>());

export const prismaRarityStore: RarityStore = {
  async stats(categoryId) {
    const hit = cache.get(categoryId);
    if (hit && Date.now() - hit.at < 30_000) return hit.stats;
    const [rows, cat] = await Promise.all([
      db.rareAnswerStat.findMany({ where: { category: categoryId }, select: { answerKey: true, count: true } }),
      db.rareCategoryStat.findUnique({ where: { category: categoryId } }),
    ]);
    const stats: RarityStats = { counts: new Map(rows.map((r) => [r.answerKey, r.count])), total: cat?.totalAnswers ?? 0 };
    cache.set(categoryId, { at: Date.now(), stats });
    return stats;
  },
  async record(categoryId: string, entry: WordEntry, playerId: string) {
    const key = answerKey(entry);
    // The composite primary key makes a second vote by the same player a no-op.
    const inserted = await db.rareAnswerVote.createMany({ data: [{ category: categoryId, answerKey: key, playerId }], skipDuplicates: true });
    if (inserted.count === 0) return false;
    await db.$transaction([
      db.rareAnswerStat.upsert({ where: { category_answerKey: { category: categoryId, answerKey: key } }, create: { category: categoryId, answerKey: key, display: entry.name, count: 1 }, update: { count: { increment: 1 } } }),
      db.rareCategoryStat.upsert({ where: { category: categoryId }, create: { category: categoryId, totalAnswers: 1, totalVoters: 1 }, update: { totalAnswers: { increment: 1 } } }),
    ]);
    const hit = cache.get(categoryId);
    if (hit) {
      hit.stats.counts.set(key, (hit.stats.counts.get(key) ?? 0) + 1);
      hit.stats.total++;
    }
    return true;
  },
};
