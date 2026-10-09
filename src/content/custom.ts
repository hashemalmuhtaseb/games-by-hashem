import { z } from "zod";

/**
 * Editor-written and pipeline-generated multiple-choice questions. They live in the database
 * (Question rows whose contentKey starts with "custom:"); the server loads the PUBLISHED ones
 * into this in-memory store, and the "community" mode serves them like any other content.
 */
export const CustomPromptSchema = z.object({
  question: z.string().trim().min(8).max(240),
  correct: z.string().trim().min(1).max(80),
  wrong: z.array(z.string().trim().min(1).max(80)).length(3),
  explanation: z.string().trim().max(300).optional(),
});
export type CustomPrompt = z.infer<typeof CustomPromptSchema>;

export interface CustomQuestion {
  key: string;
  topic: string;
  difficulty: number;
  origin: "dataset" | "admin" | "ai" | "import";
  source?: string;
  prompt: CustomPrompt;
}

export const CUSTOM_PREFIX = "custom:";

const g = globalThis as unknown as { __pvCustom?: { list: CustomQuestion[]; byKey: Map<string, CustomQuestion> } };
const store = (g.__pvCustom ??= { list: [], byKey: new Map() });

export function setCustomQuestions(list: CustomQuestion[]) {
  store.list = list;
  store.byKey = new Map(list.map((q) => [q.key, q]));
}

export function customQuestions(): CustomQuestion[] {
  return store.list;
}

export function customQuestion(key: string): CustomQuestion | undefined {
  return store.byKey.get(key);
}
