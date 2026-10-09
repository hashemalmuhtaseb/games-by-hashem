import { shortId, shuffle, sample, type Rng } from "./rng";
import type { Candidate, MediaRef, OptionPublic, Round, RoundKind, SecretRound, SuggestSet } from "./types";

export interface RoundBase {
  c: Candidate;
  modeLabel: string;
  prompt: string;
  media?: MediaRef[];
  timeLimitSec: number;
  explanation?: string;
  source?: string;
}

function base(b: RoundBase, kind: RoundKind, secret: SecretRound, extra: Partial<Round["pub"]> = {}): Round {
  return {
    gameSlug: b.c.gameSlug,
    handler: kind,
    contentKey: b.c.key,
    subjectKey: b.c.subject,
    topic: b.c.topic,
    difficulty: b.c.difficulty,
    pub: {
      kind,
      gameSlug: b.c.gameSlug,
      mode: b.c.mode,
      modeLabel: b.modeLabel,
      prompt: b.prompt,
      media: b.media,
      timeLimitSec: b.timeLimitSec,
      topic: b.c.topic,
      difficulty: b.c.difficulty,
      ...extra,
    },
    secret: { explanation: b.explanation, source: b.source, ...secret },
  };
}

export interface OptionInput {
  label: string;
  sub?: string;
  media?: MediaRef;
}

export function makeOptions(rng: Rng, correct: OptionInput, distractors: OptionInput[]): { options: OptionPublic[]; correctId: string } {
  const all = shuffle(rng, [{ ...correct, ok: true }, ...distractors.map((d) => ({ ...d, ok: false }))]);
  let correctId = "";
  const options = all.map((o) => {
    const id = shortId(rng, 8);
    if (o.ok) correctId = id;
    return { id, label: o.label, sub: o.sub, media: o.media };
  });
  return { options, correctId };
}

export function choiceRound(b: RoundBase & { rng: Rng; correct: OptionInput; distractors: OptionInput[]; answerLabel?: string }): Round {
  const { options, correctId } = makeOptions(b.rng, b.correct, b.distractors);
  return base(b, "choice", { answerLabel: b.answerLabel ?? b.correct.label, correctOptionId: correctId }, { options });
}

export function textRound(b: RoundBase & { accept: string[]; answerLabel: string; placeholder?: string; suggest?: SuggestSet }): Round {
  return base(b, "text", { answerLabel: b.answerLabel, accept: b.accept }, { input: { placeholder: b.placeholder ?? "Type your answer…", suggest: b.suggest } });
}

export function numberRound(
  b: RoundBase & { value: number; min: number; max: number; step?: number; unit?: string; scale?: "linear" | "log"; tolerance: number; answerLabel?: string },
): Round {
  return base(
    b,
    "number",
    { answerLabel: b.answerLabel ?? `${b.value}${b.unit ? " " + b.unit : ""}`, numeric: { value: b.value, unit: b.unit, scale: b.scale ?? "linear", tolerance: b.tolerance } },
    { input: { numeric: { min: b.min, max: b.max, step: b.step ?? 1, unit: b.unit, log: b.scale === "log" } } },
  );
}

export function cluesRound(
  b: RoundBase & { clues: string[]; accept?: string[]; answerLabel: string; rng?: Rng; correct?: OptionInput; distractors?: OptionInput[]; suggest?: SuggestSet },
): Round {
  let options: OptionPublic[] | undefined;
  let correctOptionId: string | undefined;
  if (b.correct && b.distractors && b.rng) {
    const o = makeOptions(b.rng, b.correct, b.distractors);
    options = o.options;
    correctOptionId = o.correctId;
  }
  return base(
    b,
    "clues",
    { answerLabel: b.answerLabel, accept: b.accept, clues: b.clues, correctOptionId },
    { totalClues: b.clues.length, extra: { clues: [b.clues[0]] }, options, input: options ? undefined : { placeholder: "Your guess…", suggest: b.suggest } },
  );
}

export function revealRound(
  b: RoundBase & { stages: MediaRef[]; accept?: string[]; answerLabel: string; rng?: Rng; correct?: OptionInput; distractors?: OptionInput[] },
): Round {
  let options: OptionPublic[] | undefined;
  let correctOptionId: string | undefined;
  if (b.correct && b.distractors && b.rng) {
    const o = makeOptions(b.rng, b.correct, b.distractors);
    options = o.options;
    correctOptionId = o.correctId;
  }
  return base(
    { ...b, media: [b.stages[0]] },
    "reveal",
    { answerLabel: b.answerLabel, accept: b.accept, stages: b.stages, correctOptionId },
    { totalClues: b.stages.length, options, input: options ? undefined : { placeholder: "Guess any time…" } },
  );
}

export function orderRound(b: RoundBase & { rng: Rng; items: OptionInput[]; answerLabel?: string; labels?: [string, string] }): Round {
  // items are given in the CORRECT order; options are shuffled.
  const withIds = b.items.map((it) => ({ ...it, id: shortId(b.rng, 8) }));
  let shuffled = shuffle(b.rng, withIds);
  if (shuffled.every((x, i) => x.id === withIds[i].id)) shuffled = shuffled.reverse();
  return base(
    b,
    "order",
    { answerLabel: b.answerLabel ?? b.items.map((i) => i.label).join(" → "), order: withIds.map((x) => x.id) },
    { options: shuffled.map(({ id, label, sub, media }) => ({ id, label, sub, media })), extra: { ends: b.labels ?? ["Highest", "Lowest"] } },
  );
}

export function genericRound(kind: RoundKind, b: RoundBase, secret: SecretRound, extra: Partial<Round["pub"]> = {}): Round {
  return base(b, kind, secret, extra);
}

export function pickDistinct<T>(rng: Rng, pool: readonly T[], n: number, key: (t: T) => string, exclude: string[] = []): T[] {
  const seen = new Set(exclude);
  const out: T[] = [];
  for (const item of shuffle(rng, pool)) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= n) break;
  }
  return out;
}

export { sample };

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}
