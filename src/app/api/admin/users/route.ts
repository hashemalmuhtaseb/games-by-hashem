import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import { trackEvent } from "@/server/progress";

const List = z.object({ q: z.string().trim().max(40).optional(), banned: z.enum(["1"]).optional() });

export const GET = route({ name: "admin-users", staff: true, schema: List, limit: [60, 2] }, async ({ body }) => {
  const users = await db.user.findMany({
    where: { ...(body.q ? { username: { contains: body.q, mode: "insensitive" as const } } : {}), ...(body.banned ? { bannedAt: { not: null } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    // Deliberately no email or password hash: the dashboard never needs them.
    select: { id: true, username: true, role: true, bannedAt: true, createdAt: true, player: { select: { id: true, avatar: true, color: true, lastSeenAt: true, profile: { select: { level: true, gamesPlayed: true, wins: true } } } } },
  });
  return { users };
});

const Patch = z.object({ userId: z.string().max(40), ban: z.boolean().optional(), role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional() });

export const PATCH = route({ name: "admin-users-update", admin: true, schema: Patch, limit: [30, 0.5] }, async ({ id, body }) => {
  if (body.userId === id.user?.id) return { error: "You can't change your own account here." };
  const target = await db.user.findUnique({ where: { id: body.userId } });
  if (!target) return { error: "No such user." };
  await db.user.update({ where: { id: target.id }, data: { ...(body.ban !== undefined ? { bannedAt: body.ban ? new Date() : null } : {}), ...(body.role ? { role: body.role } : {}) } });
  // A ban takes effect immediately: every session is revoked.
  if (body.ban) await db.session.deleteMany({ where: { userId: target.id } });
  await trackEvent("admin_action", id.player.id, null, { action: "user_update", target: target.username, ban: body.ban, role: body.role, by: id.user?.username });
  return { ok: true };
});
