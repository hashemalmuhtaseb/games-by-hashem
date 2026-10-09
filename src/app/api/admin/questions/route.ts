import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CUSTOM_PREFIX } from "@/content/custom";
import { validateDraft } from "@/content/pipeline/validate";
import { existingFingerprints, newCustomKey } from "@/server/content-jobs";
import { refreshCustomContent } from "@/server/custom-content";
import { invalidateExcluded } from "@/server/history";
import { trackEvent } from "@/server/progress";

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "RETIRED"] as const;

const List = z.object({
  status: z.enum(STATUSES).optional(),
  game: z.string().max(40).optional(),
  origin: z.enum(["DATASET", "ADMIN", "AI", "IMPORT"]).optional(),
  custom: z.enum(["1", "0"]).optional(),
  reported: z.enum(["1"]).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

export const GET = route({ name: "admin-questions", staff: true, schema: List, limit: [60, 2] }, async ({ body }) => {
  const where: Prisma.QuestionWhereInput = {};
  if (body.status) where.status = body.status;
  if (body.game) where.gameSlug = body.game;
  if (body.origin) where.origin = body.origin;
  if (body.custom === "1") where.contentKey = { startsWith: CUSTOM_PREFIX };
  if (body.reported) where.reportCount = { gt: 0 };
  if (body.q) where.OR = [{ contentKey: { contains: body.q, mode: "insensitive" } }, { topic: { contains: body.q, mode: "insensitive" } }, { fingerprint: { contains: body.q.toLowerCase() } }];
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: body.reported ? { reportCount: "desc" } : { updatedAt: "desc" },
      skip: body.page * 50,
      take: 50,
      select: { id: true, contentKey: true, gameSlug: true, topic: true, difficulty: true, status: true, origin: true, prompt: true, playCount: true, reportCount: true, updatedAt: true, source: { select: { name: true, license: true } } },
    }),
  ]);
  return { total, page: body.page, rows };
});

const Prompt = z.object({ question: z.string(), correct: z.string(), wrong: z.array(z.string()), explanation: z.string().optional() });

const Create = z.object({ prompt: Prompt, topic: z.string().trim().min(2).max(60), difficulty: z.number().int().min(1).max(5), publish: z.boolean().default(false) });

export const POST = route({ name: "admin-questions-create", staff: true, schema: Create, limit: [30, 0.5] }, async ({ id, body }) => {
  const v = validateDraft(body.prompt, await existingFingerprints());
  if (!v.ok || !v.prompt || !v.fingerprint) return { error: `Not saved: ${v.reasons.join("; ")}` };
  const key = newCustomKey();
  const q = await db.question.create({
    data: {
      contentKey: key,
      gameSlug: "roulette",
      subjectKey: key,
      topic: body.topic,
      difficulty: body.difficulty,
      prompt: v.prompt,
      fingerprint: v.fingerprint,
      origin: "ADMIN",
      status: body.publish ? "PUBLISHED" : "PENDING_REVIEW",
      answers: { create: [{ value: v.prompt.correct }, ...v.prompt.wrong.map((w) => ({ value: w, isCorrect: false }))] },
    },
  });
  await trackEvent("admin_action", id.player.id, null, { action: "question_create", key, by: id.user?.username });
  if (body.publish) await refreshCustomContent(true);
  return { ok: true, id: q.id, contentKey: key };
});

const Patch = z.object({
  ids: z.array(z.string().max(40)).min(1).max(100),
  status: z.enum(STATUSES).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  prompt: Prompt.optional(),
  clearReports: z.boolean().optional(),
});

export const PATCH = route({ name: "admin-questions-update", staff: true, schema: Patch, limit: [60, 1] }, async ({ id, body }) => {
  const rows = await db.question.findMany({ where: { id: { in: body.ids } }, select: { id: true, contentKey: true } });
  if (body.prompt) {
    if (rows.length !== 1 || !rows[0].contentKey.startsWith(CUSTOM_PREFIX)) return { error: "Only one custom question can be edited at a time." };
    const others = (await existingFingerprints()).filter((e) => e.key !== rows[0].contentKey);
    const v = validateDraft(body.prompt, others);
    if (!v.ok || !v.prompt) return { error: `Not saved: ${v.reasons.join("; ")}` };
    await db.question.update({ where: { id: rows[0].id }, data: { prompt: v.prompt, fingerprint: v.fingerprint } });
  }
  const data: Prisma.QuestionUpdateManyMutationInput = {};
  if (body.status) data.status = body.status;
  if (body.difficulty) data.difficulty = body.difficulty;
  if (body.clearReports) data.reportCount = 0;
  if (Object.keys(data).length) await db.question.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data });
  if (body.clearReports) await db.contentReport.updateMany({ where: { questionId: { in: rows.map((r) => r.id) }, status: "OPEN" }, data: { status: "DISMISSED" } });
  invalidateExcluded();
  await refreshCustomContent(true);
  await trackEvent("admin_action", id.player.id, null, { action: "question_update", count: rows.length, status: body.status, by: id.user?.username });
  return { ok: true, updated: rows.length };
});
