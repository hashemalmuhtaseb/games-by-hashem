import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import { CUSTOM_PREFIX, CustomPromptSchema, setCustomQuestions, type CustomQuestion } from "@/content/custom";
import { invalidateModeCandidates } from "@/engine/selection";
import { invalidateCatalog } from "./catalog";

const state = singleton("customContent", () => ({ at: 0, loading: null as Promise<void> | null }));

const ORIGIN: Record<string, CustomQuestion["origin"]> = { DATASET: "dataset", ADMIN: "admin", AI: "ai", IMPORT: "import" };

/** Loads published custom questions into the engine's store (cached for a minute). */
export async function refreshCustomContent(force = false): Promise<void> {
  if (!force && Date.now() - state.at < 60_000) return;
  if (state.loading) return state.loading;
  state.loading = (async () => {
    const rows = await db.question.findMany({
      where: { contentKey: { startsWith: CUSTOM_PREFIX }, status: "PUBLISHED" },
      select: { contentKey: true, topic: true, difficulty: true, origin: true, prompt: true, source: { select: { name: true } } },
      take: 20_000,
    });
    const list: CustomQuestion[] = [];
    for (const r of rows) {
      const p = CustomPromptSchema.safeParse(r.prompt);
      if (!p.success) continue;
      list.push({ key: r.contentKey, topic: r.topic, difficulty: r.difficulty, origin: ORIGIN[r.origin] ?? "admin", source: r.source?.name, prompt: p.data });
    }
    setCustomQuestions(list);
    invalidateModeCandidates("community");
    invalidateCatalog();
    state.at = Date.now();
  })().finally(() => {
    state.loading = null;
  });
  return state.loading;
}
