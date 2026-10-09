import { compact } from "@/engine/normalize";
import { createRng, pick, sample, shuffle, type Rng } from "@/engine/rng";
import { COUNTRIES } from "../datasets/countries";
import { CLUBS } from "../datasets/football";
import { MOVIES } from "../datasets/movies";
import { CELEBRITIES } from "../datasets/celebrities";

/**
 * Content providers for the question pipeline. Every provider returns raw drafts; the
 * pipeline validates them, removes near-duplicates and decides whether they need review.
 *
 * - "facts" is always available and needs no AI: it writes questions from the verified
 *   datasets using templates, so its answers are true by construction.
 * - "anthropic" and "openai-compatible" are optional and only switch on when AI_PROVIDER and
 *   AI_API_KEY are configured. Their output is never trusted: it always goes to human review.
 */

export interface GenRequest {
  topic: string;
  count: number;
  difficulty: number; // 1..5
  seed?: string;
}

export interface Draft {
  question: string;
  correct: string;
  wrong: string[];
  explanation?: string;
  difficulty?: number;
  topic?: string;
}

export interface ContentProvider {
  id: string;
  label: string;
  /** AI output is unverified and must be reviewed; dataset templates are verified by construction. */
  verified: boolean;
  topics: string[];
  unavailableReason(): string | null;
  generate(req: GenRequest): Promise<Draft[]>;
}

// ───────────────────────── facts (non-AI) ─────────────────────────

type Template = (rng: Rng) => Draft | null;

const distinctBy = <T>(rng: Rng, pool: T[], n: number, key: (x: T) => string, avoid: Set<string>): T[] => {
  const out: T[] = [];
  const seen = new Set(avoid);
  for (const x of shuffle(rng, pool)) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length === n) break;
  }
  return out;
};

const sovereign = COUNTRIES.filter((c) => c.independent && c.unMember);

const GEO: Template[] = [
  (rng) => {
    const c = pick(rng, sovereign.filter((x) => x.currencies.length === 1));
    const cur = c.currencies[0];
    if (sovereign.filter((x) => x.currencies.includes(cur)).length > 1) return null;
    // "Algerian dinar" would give Algeria away.
    if (compact(cur).includes(compact(c.name).slice(0, 5))) return null;
    const wrong = distinctBy(rng, sovereign.filter((x) => x.region === c.region && !x.currencies.includes(cur)), 3, (x) => x.name, new Set([c.name]));
    if (wrong.length < 3) return null;
    return { question: `Which country's official currency is the ${cur}?`, correct: c.name, wrong: wrong.map((x) => x.name), explanation: `The ${cur} is the currency of ${c.name}.`, difficulty: Math.min(5, c.fame + 1), topic: "geography/currency" };
  },
  (rng) => {
    const c = pick(rng, sovereign.filter((x) => x.landlocked));
    const wrong = distinctBy(rng, sovereign.filter((x) => !x.landlocked && x.region === c.region), 3, (x) => x.name, new Set());
    if (wrong.length < 3) return null;
    return { question: "Which of these countries is landlocked?", correct: c.name, wrong: wrong.map((x) => x.name), explanation: `${c.name} has no coastline.`, difficulty: Math.min(5, c.fame + 1), topic: "geography/landlocked" };
  },
  (rng) => {
    const c = pick(rng, sovereign.filter((x) => x.borders.length >= 3));
    const neighbours = new Set(c.borders);
    const bordering = COUNTRIES.filter((x) => neighbours.has(x.iso3));
    const correct = pick(rng, bordering);
    const wrong = distinctBy(rng, sovereign.filter((x) => x.region === c.region && x.iso3 !== c.iso3 && !neighbours.has(x.iso3)), 3, (x) => x.name, new Set());
    if (!correct || wrong.length < 3) return null;
    return { question: `Which of these countries shares a land border with ${c.name}?`, correct: correct.name, wrong: wrong.map((x) => x.name), explanation: `${c.name} borders ${bordering.map((x) => x.name).join(", ")}.`, difficulty: Math.min(5, Math.max(c.fame, correct.fame) + 1), topic: "geography/borders" };
  },
];

const FOOTBALL: Template[] = [
  (rng) => {
    const c = pick(rng, CLUBS);
    if (CLUBS.filter((x) => x.stadium === c.stadium).length > 1) return null;
    const wrong = distinctBy(rng, CLUBS.filter((x) => x.stadium !== c.stadium), 3, (x) => x.name, new Set([c.name]));
    return { question: `Which club plays its home games at ${c.stadium}?`, correct: c.name, wrong: wrong.map((x) => x.name), explanation: `${c.stadium} is home to ${c.name}.`, difficulty: c.difficulty + 1, topic: "football/stadiums" };
  },
  (rng) => {
    const c = pick(rng, CLUBS);
    const wrong = distinctBy(rng, CLUBS.filter((x) => x.city !== c.city), 3, (x) => x.city, new Set([c.city]));
    return { question: `In which city are ${c.name} based?`, correct: c.city, wrong: wrong.map((x) => x.city), explanation: `${c.name} are based in ${c.city}, ${c.country}.`, difficulty: c.difficulty, topic: "football/clubs" };
  },
  (rng) => {
    const c = pick(rng, CLUBS);
    // Al Ahly and Manchester United are both "Red Devils": never offer a club whose nickname overlaps.
    const nick = compact(c.nickname.replace(/\(.*\)/, ""));
    const wrong = distinctBy(rng, CLUBS.filter((x) => !compact(x.nickname).includes(nick) && !nick.includes(compact(x.nickname.replace(/\(.*\)/, "")))), 3, (x) => x.name, new Set([c.name]));
    return { question: `Which club is nicknamed "${c.nickname}"?`, correct: c.name, wrong: wrong.map((x) => x.name), explanation: `${c.name}'s nickname is ${c.nickname}.`, difficulty: c.difficulty + 1, topic: "football/clubs" };
  },
];

const MOVIE: Template[] = [
  (rng) => {
    const m = pick(rng, MOVIES);
    const wrong = distinctBy(rng, MOVIES.filter((x) => x.director !== m.director), 3, (x) => x.director, new Set([m.director]));
    return { question: `Who directed ${m.title} (${m.year})?`, correct: m.director, wrong: wrong.map((x) => x.director), explanation: `${m.title} was directed by ${m.director}.`, difficulty: m.difficulty + 1, topic: "movies/directors" };
  },
  (rng) => {
    const winners = MOVIES.filter((x) => x.bestPicture);
    if (!winners.length) return null;
    const m = pick(rng, winners);
    const wrong = sample(rng, MOVIES.filter((x) => !x.bestPicture && Math.abs(x.year - m.year) < 15), 3);
    if (wrong.length < 3) return null;
    return { question: "Which of these films won the Academy Award for Best Picture?", correct: m.title, wrong: wrong.map((x) => x.title), explanation: `${m.title} (${m.year}) won Best Picture.`, difficulty: m.difficulty + 1, topic: "movies/awards" };
  },
];

// No nationality template: dual nationals (e.g. Israeli-American actors) make it ambiguous.
const CELEB: Template[] = [
  (rng) => {
    const c = pick(rng, CELEBRITIES.filter((x) => x.knownFor.length));
    const work = pick(rng, c.knownFor);
    const wrong = distinctBy(rng, CELEBRITIES.filter((x) => x.profession === c.profession && !x.knownFor.includes(work)), 3, (x) => x.name, new Set([c.name]));
    if (wrong.length < 3) return null;
    return { question: `Who is known for ${work}?`, correct: c.name, wrong: wrong.map((x) => x.name), explanation: `${c.name}: ${c.knownFor.join(", ")}.`, difficulty: c.difficulty, topic: "celebs/known-for" };
  },
];

const FACT_TOPICS: Record<string, Template[]> = { geography: GEO, football: FOOTBALL, movies: MOVIE, celebs: CELEB };

export const factsProvider: ContentProvider = {
  id: "facts",
  label: "Dataset templates (no AI)",
  verified: true,
  topics: ["any", ...Object.keys(FACT_TOPICS)],
  unavailableReason: () => null,
  async generate(req) {
    const rng = createRng(req.seed ?? `${Date.now()}-${Math.random()}`);
    const templates = req.topic === "any" || !FACT_TOPICS[req.topic] ? Object.values(FACT_TOPICS).flat() : FACT_TOPICS[req.topic];
    const out: Draft[] = [];
    for (let i = 0; i < req.count * 8 && out.length < req.count; i++) {
      const d = pick(rng, templates)(rng);
      // Templates like "In which city are Manchester United based?" can give the answer away.
      if (!d || compact(d.question).includes(compact(d.correct))) continue;
      d.difficulty = Math.max(1, Math.min(5, d.difficulty ?? req.difficulty));
      if (Math.abs(d.difficulty - req.difficulty) > 1 && i < req.count * 4) continue;
      out.push(d);
    }
    return out;
  },
};

// ───────────────────────── AI providers (optional) ─────────────────────────

const AI_TOPICS = ["any", "general knowledge", "geography", "history", "science", "football", "movies", "music", "food", "sport", "technology", "nature"];

export function aiPrompt(req: GenRequest): string {
  return [
    `Write ${req.count} multiple-choice party-quiz questions about ${req.topic === "any" ? "a broad mix of general-knowledge topics" : req.topic}.`,
    `Target difficulty ${req.difficulty} on a 1 (everyone knows) to 5 (expert) scale.`,
    "Rules: one unambiguous correct answer; three plausible but definitely wrong options; no 'all/none of the above';",
    "the question must not contain the answer; only well-established facts that will not change (no 'current' holders, no records likely to be broken);",
    "no living people's private lives; keep the question under 200 characters and each option under 60.",
    'Reply with ONLY a JSON array of objects: {"question": string, "correct": string, "wrong": [string, string, string], "explanation": string, "difficulty": number}.',
  ].join(" ");
}

/** Pulls the first JSON array out of a model reply (models sometimes wrap it in prose or fences). */
export function parseDrafts(text: string): Draft[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("The model reply did not contain a JSON array.");
  const arr = JSON.parse(text.slice(start, end + 1)) as unknown;
  if (!Array.isArray(arr)) throw new Error("The model reply was not an array.");
  return arr.filter((x): x is Draft => !!x && typeof x === "object");
}

function aiConfigured(kind: string): string | null {
  if (kind !== "anthropic" && kind !== "openai-compatible") return "AI_PROVIDER is not set.";
  if ((process.env.AI_PROVIDER ?? "") !== kind) return `Set AI_PROVIDER="${kind}" to enable.`;
  if (!process.env.AI_API_KEY) return "AI_API_KEY is not set.";
  if (kind === "openai-compatible" && !process.env.AI_BASE_URL) return "AI_BASE_URL is not set.";
  return null;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 90_000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw new Error(`The AI provider answered HTTP ${res.status}.`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** One prompt → one text reply from whichever AI provider is configured (null when none is). */
export async function aiComplete(prompt: string, maxTokens = 1000): Promise<string> {
  const kind = process.env.AI_PROVIDER ?? "";
  if (aiConfigured(kind)) throw new Error("No AI provider is configured.");
  if (kind === "anthropic") {
    const data = (await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": process.env.AI_API_KEY!, "anthropic-version": "2023-06-01" },
      { model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] },
    )) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).map((c) => c.text ?? "").join("");
  }
  const base = process.env.AI_BASE_URL!.replace(/\/$/, "");
  const data = (await postJson(`${base}/chat/completions`, { authorization: `Bearer ${process.env.AI_API_KEY}` }, { model: process.env.AI_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export function aiAvailable(): boolean {
  return aiConfigured(process.env.AI_PROVIDER ?? "") === null;
}

export const anthropicProvider: ContentProvider = {
  id: "anthropic",
  label: "Anthropic Claude (AI)",
  verified: false,
  topics: AI_TOPICS,
  unavailableReason: () => aiConfigured("anthropic"),
  generate: async (req) => parseDrafts(await aiComplete(aiPrompt(req), 4000)),
};

export const openAiCompatibleProvider: ContentProvider = {
  id: "openai-compatible",
  label: "OpenAI-compatible endpoint (AI)",
  verified: false,
  topics: AI_TOPICS,
  unavailableReason: () => aiConfigured("openai-compatible"),
  generate: async (req) => parseDrafts(await aiComplete(aiPrompt(req), 4000)),
};

export const PROVIDERS: ContentProvider[] = [factsProvider, anthropicProvider, openAiCompatibleProvider];

export function providerById(id: string): ContentProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
