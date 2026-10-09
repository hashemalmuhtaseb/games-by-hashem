import { route, z } from "@/lib/api";
import { db } from "@/lib/db";

const Body = z.object({
  kind: z.enum(["content", "user"]),
  contentKey: z.string().max(120).optional(),
  targetPlayerId: z.string().max(40).optional(),
  reason: z.string().trim().min(3).max(500),
});

export const POST = route({ name: "report", schema: Body, limit: [6, 0.05] }, async ({ id, body }) => {
  if (body.kind === "content" && body.contentKey) {
    const q = await db.question.findUnique({ where: { contentKey: body.contentKey } });
    const created = await db.contentReport.createMany({ data: [{ contentKey: body.contentKey, questionId: q?.id, playerId: id.player.id, reason: body.reason }], skipDuplicates: true });
    if (created.count && q) await db.question.update({ where: { id: q.id }, data: { reportCount: { increment: 1 } } });
    return { ok: true };
  }
  if (body.kind === "user" && body.targetPlayerId) {
    await db.userReport.create({ data: { reporterPlayerId: id.player.id, targetPlayerId: body.targetPlayerId, reason: body.reason } });
    return { ok: true };
  }
  return { error: "Nothing to report." };
});
