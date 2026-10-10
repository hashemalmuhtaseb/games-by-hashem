import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import { AVATARS, COLORS } from "@/lib/auth";
import { publicProfile } from "@/server/profiles";
import { refreshPlayerEverywhere } from "@/server/rooms";

export const GET = route({ name: "me" }, async ({ id }) => ({ me: await publicProfile(id.player.id, true), user: id.user ? { username: id.user.username, role: id.user.role } : null }));

const Patch = z.object({
  displayName: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N} _.-]+$/u, "Letters, numbers, spaces, _ . - only").optional(),
  avatar: z.string().refine((a) => AVATARS.includes(a), "Unknown avatar").optional(),
  color: z.string().refine((c) => COLORS.includes(c), "Unknown colour").optional(),
  bio: z.string().max(280).optional(),
  favoriteCategories: z.array(z.string().max(30)).max(6).optional(),
});

export const PATCH = route({ name: "me.patch", schema: Patch, limit: [10, 0.2] }, async ({ id, body }) => {
  const { bio, favoriteCategories, ...player } = body;
  if (Object.keys(player).length) {
    await db.player.update({ where: { id: id.player.id }, data: player });
    refreshPlayerEverywhere(id.player.id, { avatar: player.avatar, name: player.displayName, color: player.color });
  }
  if (bio !== undefined || favoriteCategories) await db.profile.upsert({ where: { playerId: id.player.id }, create: { playerId: id.player.id, bio, favoriteCategories }, update: { bio, favoriteCategories } });
  return { me: await publicProfile(id.player.id, true) };
});
