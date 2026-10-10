/**
 * Two medicine games built on the fictional teaching cases in content/datasets/medical.ts.
 *
 *  - Diagnose the Patient: read a full case and name the most likely diagnosis. Beginner and
 *    intermediate are multiple choice; advanced is free text. An optional hint costs points.
 *  - Medical Mystery: start with only the presenting complaint and unlock clues (symptoms,
 *    history, vitals, examination, blood tests, imaging, other tests). Every clue costs points,
 *    wrong diagnoses cost points, and a fast, frugal correct diagnosis earns a bonus.
 *
 * Answers are checked against each case's validated diagnosis and its accepted synonyms only.
 */
import { MED_CASES, MED_DISCLAIMER, MED_SPECIALTIES, type MedCase } from "@/content/datasets/medical";
import { genericRound, makeOptions } from "../build";
import { shuffle } from "../rng";
import type { Candidate, GameDefinition, ModeDefinition, Round } from "../types";
import { compact, findMatch, type MatchCandidate } from "../normalize";

export const DIAGNOSE_SLUG = "diagnose";
export const MYSTERY_SLUG = "medical-mystery";

const LEVEL_DIFFICULTY: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 4 };
const sexWord = (c: MedCase) => (c.age < 1 ? (c.sex === "male" ? "baby boy" : "baby girl") : c.age < 13 ? (c.sex === "male" ? "boy" : "girl") : c.sex === "male" ? "man" : "woman");
export const patientLine = (c: MedCase) => (c.age < 1 ? `A ${sexWord(c)}` : `A ${c.age}-year-old ${sexWord(c)}`);

export interface CaseSection {
  id: string;
  label: string;
  items: string[];
}

/** The case sheet, in the order a clinician would take it. */
export function caseSections(c: MedCase): CaseSection[] {
  const s: CaseSection[] = [
    { id: "symptoms", label: "Symptoms", items: c.symptoms },
    { id: "history", label: "Medical history", items: c.history },
    { id: "vitals", label: "Vital signs", items: c.vitals.map((x) => `${x.label}: ${x.value}`) },
    { id: "exam", label: "Examination", items: c.exam },
  ];
  if (c.labs?.length) s.push({ id: "labs", label: "Blood & lab tests", items: c.labs });
  if (c.imaging?.length) s.push({ id: "imaging", label: "Imaging", items: c.imaging });
  if (c.other?.length) s.push({ id: "other", label: "Other tests", items: c.other });
  return s;
}

export const CLUE_COST: Record<string, number> = { symptoms: 10, history: 10, vitals: 10, exam: 15, labs: 20, imaging: 20, other: 15 };

const SOURCE = (c: MedCase) => `Teaching point: ${c.reference}. ${MED_DISCLAIMER}`;

function accept(c: MedCase): string[] {
  return [c.diagnosis, ...c.aliases];
}

// ───────────────────────── answer checking ─────────────────────────

let matchers: MatchCandidate<string>[] | null = null;

/**
 * Is a typed diagnosis right for this case? Medical names that differ by one letter are often
 * different diseases (hypo- vs hyperthyroidism, hepatitis A vs B), so a typo is only forgiven when
 * the closest known diagnosis — across every case and every distractor — is this case's own.
 * Shared synonyms ("IBD" for Crohn's and UC) count for every case that lists them.
 */
export function isCorrectDiagnosis(input: string, caseId: string): boolean {
  const c = MED_CASES.find((x) => x.id === caseId);
  if (!c) return false;
  const k = compact(input);
  if (!k) return false;
  if ([c.diagnosis, ...c.aliases].some((n) => compact(n) === k)) return true;
  if (!matchers) {
    const known = new Set(MED_CASES.flatMap((x) => [x.diagnosis, ...x.aliases].map(compact)));
    matchers = [
      ...MED_CASES.map((x) => ({ value: x.id, names: [x.diagnosis, ...x.aliases] })),
      // Distractors that aren't any case's diagnosis are still real, different conditions.
      ...[...new Set(MED_CASES.flatMap((x) => x.distractors))].filter((d) => !known.has(compact(d))).map((d) => ({ value: `other:${d}`, names: [d] })),
    ];
  }
  // An exact match to anything else (a distractor, another case) is a different diagnosis.
  if (matchers.some((m) => m.names.some((n) => compact(n) === k))) return false;
  return findMatch(input, matchers)?.value === caseId;
}

// ───────────────────────── Diagnose the Patient ─────────────────────────

function diagnoseMode(id: string, label: string, description: string, levels: (1 | 2 | 3)[], freeText: boolean): ModeDefinition {
  const pool = () => MED_CASES.filter((c) => levels.includes(c.level));
  return {
    id,
    label,
    kinds: ["case"],
    description,
    candidates: () =>
      pool().map((c) => ({ key: `med:dx:${id}:${c.id}`, subject: `medcase:${c.id}`, topic: `medicine/${c.specialty.toLowerCase()}`, difficulty: LEVEL_DIFFICULTY[c.level] + (freeText ? 1 : 0), mode: id, gameSlug: DIAGNOSE_SLUG, ref: c.id })),
    build(cand, ctx) {
      const c = MED_CASES.find((x) => x.id === cand.ref)!;
      const sheet = { patient: patientLine(c), complaint: c.complaint, specialty: c.specialty, sections: caseSections(c), disclaimer: MED_DISCLAIMER };
      const base = {
        c: cand,
        modeLabel: `🩺 ${label} · ${c.specialty}`,
        prompt: "What is the most likely diagnosis?",
        timeLimitSec: ctx.timeLimitSec ?? (freeText ? 90 : 60),
        explanation: c.explanation,
        source: SOURCE(c),
      };
      if (freeText) {
        return genericRound("case", base, { answerLabel: c.diagnosis, accept: accept(c), data: { hint: c.hint, caseId: c.id } }, { extra: { case: sheet, hasHint: true }, input: { placeholder: "Type the diagnosis…", suggest: "diagnoses" } });
      }
      const { options, correctId } = makeOptions(ctx.rng, { label: c.diagnosis }, shuffle(ctx.rng, c.distractors).slice(0, 3).map((d) => ({ label: d })));
      return genericRound("case", base, { answerLabel: c.diagnosis, correctOptionId: correctId, data: { hint: c.hint } }, { options, extra: { case: sheet, hasHint: true } });
    },
  };
}

export const diagnoseGame: GameDefinition = {
  slug: DIAGNOSE_SLUG,
  name: "Diagnose the Patient",
  short: "Read a fictional patient's case — symptoms, history, vitals, exam and tests — and name the most likely diagnosis.",
  icon: "🩺",
  accent: ["#0ea5e9", "#14b8a6"],
  group: "trivia",
  rules: [
    "Each round is a fictional teaching case. Read the history, vital signs, examination and test results.",
    "Beginner and Intermediate are multiple choice. Advanced asks you to type the diagnosis (common synonyms count).",
    "Stuck? Take a hint — it costs 30% of the round's points.",
    "After each case you'll see the explanation and the reference it's based on.",
    "For learning and fun only: these cases are invented and are not medical advice.",
  ],
  modes: [
    diagnoseMode("beginner", "Beginner", "Classic presentations of common conditions, multiple choice.", [1], false),
    diagnoseMode("intermediate", "Intermediate", "Trickier cases with closer alternatives, multiple choice.", [2], false),
    diagnoseMode("advanced", "Advanced", "Harder cases — type the diagnosis yourself.", [2, 3], true),
  ],
  rounds: 8,
  timeLimitSec: 60,
  multiplayer: true,
  scoring: { speedBonus: 40 },
};

// ───────────────────────── Medical Mystery ─────────────────────────

function mysteryMode(id: string, label: string, specialties: string[] | null): ModeDefinition {
  const pool = () => MED_CASES.filter((c) => !specialties || specialties.includes(c.specialty));
  return {
    id,
    label,
    kinds: ["investigate"],
    description: specialties ? `Cases from ${specialties.join(", ")}.` : "Cases from every specialty.",
    candidates: () =>
      pool().map((c) => ({ key: `med:mystery:${id}:${c.id}`, subject: `medcase:${c.id}`, topic: `medicine/${c.specialty.toLowerCase()}`, difficulty: LEVEL_DIFFICULTY[c.level], mode: id, gameSlug: MYSTERY_SLUG, ref: c.id })),
    build(cand, ctx) {
      const c = MED_CASES.find((x) => x.id === cand.ref)!;
      const sections = caseSections(c);
      // Five possible diagnoses: the right one and four validated distractors.
      const { options, correctId } = makeOptions(ctx.rng, { label: c.diagnosis }, c.distractors.slice(0, 4).map((d) => ({ label: d })));
      return genericRound(
        "investigate",
        {
          c: cand,
          modeLabel: `🔬 Medical Mystery · ${c.specialty}`,
          prompt: "Investigate the patient, then make your diagnosis.",
          timeLimitSec: ctx.timeLimitSec ?? 120,
          explanation: c.explanation,
          source: SOURCE(c),
        },
        { answerLabel: c.diagnosis, correctOptionId: correctId, data: { sections: Object.fromEntries(sections.map((s) => [s.id, s.items])) } },
        {
          options,
          extra: {
            budget: MYSTERY_BUDGET,
            clues: sections.map((s) => ({ id: s.id, label: s.label, cost: CLUE_COST[s.id] ?? 15 })),
            patient: patientLine(c),
            complaint: c.complaint,
            disclaimer: MED_DISCLAIMER,
          },
        },
      );
    },
  };
}

export const MYSTERY_BUDGET = 100;
export const MYSTERY_WRONG_PENALTY = 20;
export const MYSTERY_FAST_BONUS = 25;
export const MYSTERY_MAX_GUESSES = 3;

const GROUPS: [string, string, string[]][] = [
  ["cardio", "Heart & lungs", ["Cardiology", "Respiratory"]],
  ["neuro", "Brain & nerves", ["Neurology", "ENT & eyes"]],
  ["emergency", "Emergency", ["Emergency medicine", "Vascular & surgery"]],
  ["infection", "Infections", ["Infectious disease", "Dermatology"]],
  ["gut-hormones", "Gut, kidneys & hormones", ["Gastroenterology", "Endocrinology", "Nephrology & urology"]],
  ["blood-joints", "Blood & joints", ["Haematology", "Rheumatology"]],
  ["children-women", "Children & women's health", ["Paediatrics", "Obstetrics & gynaecology"]],
];

export const mysteryGame: GameDefinition = {
  slug: MYSTERY_SLUG,
  name: "Medical Mystery",
  short: "Play detective: unlock clues about a fictional patient — each costs points — and diagnose them with as few as possible.",
  icon: "🔬",
  accent: ["#14b8a6", "#6366f1"],
  group: "trivia",
  original: true,
  rules: [
    `You start with ${MYSTERY_BUDGET} points and only the patient's main complaint.`,
    "Unlock clues — symptoms, history, vital signs, examination, blood tests, imaging, other tests. Each clue costs points (shown on the button).",
    `Pick the diagnosis when you're ready. A wrong guess costs ${MYSTERY_WRONG_PENALTY} points; after ${MYSTERY_MAX_GUESSES} wrong guesses the case closes.`,
    `Correct with two clues or fewer, in under half the time? +${MYSTERY_FAST_BONUS} bonus.`,
    "Cases are fictional and for learning only — not medical advice.",
  ],
  modes: [mysteryMode("all", "All specialties", null), ...GROUPS.filter(([, , specs]) => specs.some((s) => MED_SPECIALTIES.includes(s as never))).map(([id, label, specs]) => mysteryMode(id, label, specs))],
  rounds: 6,
  timeLimitSec: 120,
  multiplayer: true,
  scoring: { speedBonus: 0 },
};

export function mysteryPoints(input: { correct: boolean; spent: number; wrong: number; elapsedMs: number; timeLimitMs: number; cluesUsed: number }): number {
  if (!input.correct) return -MYSTERY_WRONG_PENALTY * Math.max(1, input.wrong);
  const base = Math.max(10, MYSTERY_BUDGET - input.spent - input.wrong * MYSTERY_WRONG_PENALTY);
  const fast = input.cluesUsed <= 2 && input.elapsedMs <= input.timeLimitMs / 2 ? MYSTERY_FAST_BONUS : 0;
  return base + fast;
}

export type { Candidate, Round };
