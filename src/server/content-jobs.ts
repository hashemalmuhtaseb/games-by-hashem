import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { CUSTOM_PREFIX } from "@/content/custom";
import { providerById, type GenRequest } from "@/content/pipeline/providers";
import { validateDraft } from "@/content/pipeline/validate";
import { refreshCustomContent } from "./custom-content";

/**
 * Runs one generation job: provider → validation → de-duplication → Question rows.
 * Verified (dataset) drafts may be published directly when the admin asks; AI drafts always
 * land in PENDING_REVIEW because no automatic check can prove a generated fact is true.
 */

export interface JobParams extends GenRequest {
  provider: string;
  autoPublish: boolean;
}

export async function existingFingerprints(): Promise<{ key: string; fingerprint: string }[]> {
  const rows = await db.question.findMany({
    where: { contentKey: { startsWith: CUSTOM_PREFIX }, status: { in: ["PUBLISHED", "PENDING_REVIEW", "DRAFT"] } },
    select: { contentKey: true, fingerprint: true },
    take: 50_000,
  });
  return rows.map((r) => ({ key: r.contentKey, fingerprint: r.fingerprint }));
}

export const newCustomKey = () => `${CUSTOM_PREFIX}${randomBytes(6).toString("base64url")}`;

export async function startGenerationJob(params: JobParams): Promise<string> {
  const provider = providerById(params.provider);
  if (!provider) throw new Error("Unknown provider.");
  const why = provider.unavailableReason();
  if (why) throw new Error(`${provider.label} is not available: ${why}`);
  const job = await db.contentGenerationJob.create({ data: { kind: "choice", provider: provider.id, status: "RUNNING", params: { ...params } } });
  void runJob(job.id, params).catch(async (e) => {
    await db.contentGenerationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 300) : "failed", finishedAt: new Date() } }).catch(() => undefined);
  });
  return job.id;
}

export async function runJob(jobId: string, params: JobParams) {
  const provider = providerById(params.provider)!;
  const drafts = await provider.generate(params);
  const existing = await existingFingerprints();
  const log: { question: string; ok: boolean; reasons: string[]; key?: string }[] = [];
  let accepted = 0;
  let rejected = 0;
  // The source name is shown to players under the reveal.
  const sourceName = provider.verified ? "Built from PartyVerse datasets" : "AI-drafted, reviewed by an editor";
  const source = await db.contentSource.upsert({
    where: { name: sourceName },
    create: { name: sourceName, license: provider.verified ? "Derived from bundled datasets" : `Generated with ${provider.label}; human-reviewed before publishing`, notes: `pipeline:${provider.id}` },
    update: {},
  });
  const status = provider.verified && params.autoPublish ? "PUBLISHED" : "PENDING_REVIEW";
  for (const d of drafts) {
    const v = validateDraft({ question: d.question, correct: d.correct, wrong: d.wrong, explanation: d.explanation }, existing);
    if (!v.ok || !v.prompt || !v.fingerprint) {
      rejected++;
      log.push({ question: String(d.question ?? "").slice(0, 200), ok: false, reasons: v.reasons });
      continue;
    }
    const key = newCustomKey();
    const difficulty = Math.max(1, Math.min(5, Math.round(Number(d.difficulty) || params.difficulty)));
    await db.question.create({
      data: {
        contentKey: key,
        gameSlug: "roulette",
        subjectKey: key,
        topic: (d.topic ?? params.topic).slice(0, 60),
        difficulty,
        prompt: v.prompt,
        fingerprint: v.fingerprint,
        status,
        origin: provider.verified ? "DATASET" : "AI",
        sourceId: source.id,
        answers: { create: [{ value: v.prompt.correct }, ...v.prompt.wrong.map((w) => ({ value: w, isCorrect: false }))] },
      },
    });
    existing.push({ key, fingerprint: v.fingerprint });
    accepted++;
    log.push({ question: v.prompt.question, ok: true, reasons: [], key });
  }
  await db.contentGenerationJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED", produced: drafts.length, accepted, rejected, log, finishedAt: new Date() } });
  if (status === "PUBLISHED") await refreshCustomContent(true);
  return { produced: drafts.length, accepted, rejected };
}
