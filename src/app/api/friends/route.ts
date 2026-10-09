import { route, z, json } from "@/lib/api";
import { db } from "@/lib/db";

const brief = (p: { id: string; displayName: string; avatar: string; color: string; lastSeenAt: Date }) => ({ id: p.id, displayName: p.displayName, avatar: p.avatar, color: p.color, lastSeenAt: p.lastSeenAt.toISOString() });

export const GET = route({ name: "friends" }, async ({ id }) => {
  const rows = await db.friendship.findMany({ where: { OR: [{ requesterId: id.player.id }, { addresseeId: id.player.id }] }, include: { requester: true, addressee: true }, orderBy: { createdAt: "desc" } });
  return {
    friends: rows.filter((r) => r.status === "ACCEPTED").map((r) => ({ id: r.id, player: brief(r.requesterId === id.player.id ? r.addressee : r.requester) })),
    incoming: rows.filter((r) => r.status === "PENDING" && r.addresseeId === id.player.id).map((r) => ({ id: r.id, player: brief(r.requester) })),
    outgoing: rows.filter((r) => r.status === "PENDING" && r.requesterId === id.player.id).map((r) => ({ id: r.id, player: brief(r.addressee) })),
  };
});

export const POST = route({ name: "friends.add", schema: z.object({ username: z.string().trim().min(3).max(20) }), limit: [10, 0.1] }, async ({ id, body }) => {
  if (!id.user) return json({ error: "Create a free account to add friends." }, 403);
  const target = await db.user.findFirst({ where: { username: { equals: body.username, mode: "insensitive" } }, include: { player: true } });
  // Same message whether or not the user exists → no username enumeration beyond what profiles show.
  if (!target?.player || target.player.id === id.player.id) return json({ error: "Couldn't send a request to that username." }, 400);
  const existing = await db.friendship.findFirst({ where: { OR: [{ requesterId: id.player.id, addresseeId: target.player.id }, { requesterId: target.player.id, addresseeId: id.player.id }] } });
  if (existing) {
    if (existing.status === "PENDING" && existing.addresseeId === id.player.id) await db.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
    return { ok: true };
  }
  await db.friendship.create({ data: { requesterId: id.player.id, addresseeId: target.player.id } });
  return { ok: true };
});

export const PATCH = route({ name: "friends.update", schema: z.object({ id: z.string().max(40), action: z.enum(["accept", "remove"]) }), limit: [20, 0.5] }, async ({ id, body }) => {
  const f = await db.friendship.findUnique({ where: { id: body.id } });
  if (!f || (f.requesterId !== id.player.id && f.addresseeId !== id.player.id)) return json({ error: "Not found" }, 404);
  if (body.action === "accept") {
    if (f.addresseeId !== id.player.id) return json({ error: "Not yours to accept" }, 403);
    await db.friendship.update({ where: { id: f.id }, data: { status: "ACCEPTED" } });
  } else await db.friendship.delete({ where: { id: f.id } });
  return { ok: true };
});
