import { route, json } from "@/lib/api";
import { AVATAR_MAX_BYTES, AvatarError, processAvatar, removeAvatar, saveAvatar, type Crop } from "@/server/avatars";
import { publicProfile } from "@/server/profiles";
import { refreshPlayerEverywhere } from "@/server/rooms";

/**
 * Upload or remove the caller's own profile picture. There is no player id in the request:
 * the picture always belongs to whoever the session cookie says is calling.
 * Body: multipart/form-data with `file` (JPG/PNG/WebP, ≤5 MB) and optional `crop` JSON {x,y,size}.
 */
export const POST = route({ name: "me.avatar", limit: [6, 0.05] }, async ({ req, id }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > AVATAR_MAX_BYTES + 64 * 1024) return json({ error: "Images must be 5 MB or smaller." }, 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Upload an image file." }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "Upload an image file." }, 400);
  if (file.size > AVATAR_MAX_BYTES) return json({ error: "Images must be 5 MB or smaller." }, 413);
  let crop: Crop | null = null;
  const rawCrop = form.get("crop");
  if (typeof rawCrop === "string" && rawCrop) {
    try {
      const c = JSON.parse(rawCrop) as Crop;
      if ([c.x, c.y, c.size].every((n) => typeof n === "number" && Number.isFinite(n))) crop = c;
    } catch {
      /* ignore a malformed crop and centre-crop instead */
    }
  }
  try {
    const webp = await processAvatar(Buffer.from(await file.arrayBuffer()), crop);
    const url = await saveAvatar(id.player.id, webp);
    refreshPlayerEverywhere(id.player.id, { photo: url });
    return { photoUrl: url, me: await publicProfile(id.player.id, true) };
  } catch (e) {
    if (e instanceof AvatarError) return json({ error: e.message }, 400);
    throw e;
  }
});

export const DELETE = route({ name: "me.avatar.delete", limit: [10, 0.2] }, async ({ id }) => {
  await removeAvatar(id.player.id);
  refreshPlayerEverywhere(id.player.id, { photo: null });
  return { photoUrl: null, me: await publicProfile(id.player.id, true) };
});
