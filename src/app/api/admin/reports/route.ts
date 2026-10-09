import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import { invalidateExcluded } from "@/server/history";
import { refreshCustomContent } from "@/server/custom-content";
import { trackEvent } from "@/server/progress";

const List = z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN") });

export const GET = route({ name: "admin-reports", staff: true, schema: List, limit: [60, 2] }, async ({ body }) => {
  const [content, users] = await Promise.all([
    db.contentReport.findMany({ where: { status: body.status }, orderBy: { createdAt: "desc" }, take: 100, include: { question: { select: { id: true, status: true, gameSlug: true, topic: true, reportCount: true, prompt: true } } } }),
    db.userReport.findMany({ where: { status: body.status }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const ids = [...new Set([...content.map((c) => c.playerId), ...users.flatMap((u) => [u.reporterPlayerId, u.targetPlayerId])])];
  const players = await db.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, avatar: true, userId: true, user: { select: { username: true, bannedAt: true } } } });
  return { content, users, players };
});

const Act = z.object({
  kind: z.enum(["content", "user"]),
  id: z.string().max(40),
  action: z.enum(["resolve", "dismiss", "retire"]),
});

export const PATCH = route({ name: "admin-reports-act", staff: true, schema: Act, limit: [60, 1] }, async ({ id, body }) => {
  const status = body.action === "dismiss" ? "DISMISSED" : "RESOLVED";
  if (body.kind === "user") {
    await db.userReport.update({ where: { id: body.id }, data: { status } });
  } else {
    const rep = await db.contentReport.update({ where: { id: body.id }, data: { status } });
    if (body.action === "retire") {
      await db.question.updateMany({ where: { contentKey: rep.contentKey }, data: { status: "RETIRED" } });
      await db.contentReport.updateMany({ where: { contentKey: rep.contentKey, status: "OPEN" }, data: { status: "RESOLVED" } });
      invalidateExcluded();
      await refreshCustomContent(true);
    } else if (body.action === "dismiss" && rep.questionId) {
      // Dismissed reports stop counting toward the automatic 3-report hide.
      const open = await db.contentReport.count({ where: { questionId: rep.questionId, status: { not: "DISMISSED" } } });
      await db.question.update({ where: { id: rep.questionId }, data: { reportCount: open } });
      invalidateExcluded();
    }
  }
  await trackEvent("admin_action", id.player.id, null, { action: `report_${body.action}`, kind: body.kind, by: id.user?.username });
  return { ok: true };
});
