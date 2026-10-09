import { compact, normalize } from "@/engine/normalize";
import { containsBlocked } from "@/lib/moderation";
import { CustomPromptSchema, type CustomPrompt } from "../custom";

/**
 * Automatic checks every generated or imported question must pass before it can even reach
 * the human review queue. They catch malformed output, giveaways and near-duplicates; they
 * cannot verify that a fact is true, which is why AI drafts always wait for a human.
 */

const STOP = new Set("a an the of in on at to for by with and or is are was were which what who whom whose when where how this that these those it its from as be been has have had do does did than then".split(" "));

export function tokens(text: string): string[] {
  return [...new Set(normalize(text).split(" ").filter((t) => t.length > 1 && !STOP.has(t)))];
}

/** Order-insensitive fingerprint of what a question asks and answers. */
export function fingerprint(p: Pick<CustomPrompt, "question" | "correct">): string {
  return tokens(`${p.question} ${p.correct}`).sort().join(" ");
}

export function similarity(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export const NEAR_DUPLICATE = 0.75;

export interface Verdict {
  ok: boolean;
  reasons: string[];
  prompt?: CustomPrompt;
  fingerprint?: string;
  duplicateOf?: string;
}

export function validateDraft(raw: unknown, existing: { key: string; fingerprint: string }[]): Verdict {
  const parsed = CustomPromptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reasons: parsed.error.issues.map((i) => `${i.path.join(".") || "draft"}: ${i.message}`).slice(0, 3) };
  const p = parsed.data;
  const reasons: string[] = [];
  const opts = [p.correct, ...p.wrong].map(compact);
  if (opts.some((o) => !o)) reasons.push("an option is empty after normalising");
  if (new Set(opts).size !== opts.length) reasons.push("options are not distinct");
  const cq = compact(p.question);
  if (compact(p.correct).length > 3 && cq.includes(compact(p.correct))) reasons.push("the question contains its own answer");
  if (!/[?.:…]$/.test(p.question.trim())) reasons.push("the question should end with ? or .");
  if ([p.question, p.correct, ...p.wrong, p.explanation ?? ""].some(containsBlocked)) reasons.push("contains blocked language");
  if (/\b(all|none) of the above\b/i.test([p.correct, ...p.wrong].join(" "))) reasons.push("'all/none of the above' options are not allowed");
  const fp = fingerprint(p);
  let duplicateOf: string | undefined;
  for (const e of existing) {
    if (similarity(fp, e.fingerprint) >= NEAR_DUPLICATE) {
      duplicateOf = e.key;
      reasons.push(`near-duplicate of ${e.key}`);
      break;
    }
  }
  return { ok: reasons.length === 0, reasons, prompt: p, fingerprint: fp, duplicateOf };
}
