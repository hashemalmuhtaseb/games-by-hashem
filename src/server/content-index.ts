import { db } from "@/lib/db";
import { allGames } from "@/engine/registry";
import { gameCandidates } from "@/engine/selection";
import { ensureAchievements } from "./progress";

/**
 * Mirrors the in-code catalogue into the database so admins can browse, retire and audit
 * every question, and so player reports attach to a real row. Idempotent: existing rows
 * (and their status, counters and admin edits) are never overwritten.
 */

export const CONTENT_SOURCES = [
  { name: "mledoze/countries", url: "https://github.com/mledoze/countries", license: "ODbL-1.0", notes: "Country names, capitals, regions, borders, areas, languages, currencies (via the world-countries npm package)." },
  { name: "country-flag-icons", url: "https://gitlab.com/catamphetamine/country-flag-icons", license: "MIT", notes: "Flag SVGs, rendered server-side." },
  { name: "PartyVerse movies pack", url: null, license: "Facts: public record. Plots/emoji: original writing.", notes: "Title, year, director, cast, Best Picture wins. No posters bundled." },
  { name: "PartyVerse football pack", url: null, license: "Facts: public record (reference date 2025-08).", notes: "Clubs represented, nationality, birth year, major honours. Questions only say 'has played for'." },
  { name: "PartyVerse songs pack", url: null, license: "Facts: public record. Descriptions/emoji: original writing.", notes: "No lyrics or audio bundled." },
  { name: "PartyVerse celebrities pack", url: null, license: "Facts: public record (reference date 2025-06). Clues: original writing.", notes: "No photos bundled." },
  { name: "PartyVerse word lists", url: null, license: "Original compilation.", notes: "Category answer lists with rarity tiers." },
  { name: "an-array-of-english-words", url: "https://github.com/words/an-array-of-english-words", license: "MIT", notes: "Dictionary for word games." },
] as const;

const SOURCE_BY_TOPIC_ROOT: Record<string, string> = {
  geography: "mledoze/countries",
  movies: "PartyVerse movies pack",
  football: "PartyVerse football pack",
  music: "PartyVerse songs pack",
  celebs: "PartyVerse celebrities pack",
  rare: "PartyVerse word lists",
  battle: "PartyVerse word lists",
  hive: "PartyVerse word lists",
  words: "an-array-of-english-words",
};

export interface SyncResult {
  games: number;
  sources: number;
  categories: number;
  questionsInCatalogue: number;
  questionsAdded: number;
}

export async function syncCatalogue(): Promise<SyncResult> {
  const games = allGames();
  for (const g of games) {
    await db.game.upsert({ where: { slug: g.slug }, create: { slug: g.slug, name: g.name }, update: { name: g.name } });
  }
  await ensureAchievements();
  await db.contentSource.createMany({ data: CONTENT_SOURCES.map((s) => ({ ...s, url: s.url ?? undefined, verifiedAt: new Date("2025-08-01") })), skipDuplicates: true });
  const sources = new Map((await db.contentSource.findMany({ select: { id: true, name: true } })).map((s) => [s.name, s.id]));

  // Each content key is owned by the first game that defines it (borrowed modes share keys).
  const rows = new Map<string, { gameSlug: string; subjectKey: string; topic: string; difficulty: number; mode: string; ref: string }>();
  for (const g of games) {
    for (const c of gameCandidates(g)) {
      if (!rows.has(c.key)) rows.set(c.key, { gameSlug: g.slug, subjectKey: c.subject, topic: c.topic, difficulty: c.difficulty, mode: c.mode, ref: c.ref });
    }
  }
  const topics = [...new Set([...rows.values()].map((r) => r.topic))];
  await db.category.createMany({ data: topics.map((t) => ({ slug: t, name: t })), skipDuplicates: true });

  let added = 0;
  const all = [...rows.entries()];
  for (let i = 0; i < all.length; i += 2000) {
    const chunk = all.slice(i, i + 2000);
    const res = await db.question.createMany({
      data: chunk.map(([key, r]) => ({
        contentKey: key,
        gameSlug: r.gameSlug,
        categorySlug: r.topic,
        subjectKey: r.subjectKey,
        topic: r.topic,
        difficulty: Math.round(r.difficulty),
        prompt: { mode: r.mode, ref: r.ref },
        fingerprint: r.subjectKey,
        status: "PUBLISHED" as const,
        origin: "DATASET" as const,
        sourceId: sources.get(SOURCE_BY_TOPIC_ROOT[r.topic.split("/")[0]] ?? "") ?? null,
      })),
      skipDuplicates: true,
    });
    added += res.count;
  }
  return { games: games.length, sources: sources.size, categories: topics.length, questionsInCatalogue: rows.size, questionsAdded: added };
}
