import sharp from "sharp";
import { db } from "@/lib/db";

/**
 * Profile pictures.
 *
 * Uploads are decoded and re-encoded on the server: whatever the browser sends, what we store and
 * serve is a fresh 256×256 WebP with no metadata. The format is checked from the file's own bytes
 * (not the extension or the declared MIME type), pixel counts are capped before decoding, and the
 * player is always the signed-in caller, so nobody can change another player's picture.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 256;
const ALLOWED = new Set(["jpeg", "png", "webp"]);
const MAX_INPUT_PIXELS = 40_000_000;

export interface Crop {
  /** Fractions of the (orientation-corrected) image, 0..1. */
  x: number;
  y: number;
  size: number;
}

export class AvatarError extends Error {}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

/** Validates, crops and re-encodes an upload. Throws AvatarError with a user-facing message. */
export async function processAvatar(input: Buffer, crop?: Crop | null): Promise<Buffer> {
  if (!input.length) throw new AvatarError("That file is empty.");
  if (input.length > AVATAR_MAX_BYTES) throw new AvatarError("Images must be 5 MB or smaller.");
  const kind = sniff(input);
  if (!kind) throw new AvatarError("Use a JPG, PNG or WebP image.");
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new AvatarError("That image couldn't be read. Try another file.");
  }
  if (!meta.format || !ALLOWED.has(meta.format) || meta.format !== kind) throw new AvatarError("Use a JPG, PNG or WebP image.");
  if ((meta.pages ?? 1) > 1) throw new AvatarError("Animated images aren't supported.");
  if (!meta.width || !meta.height || meta.width < 32 || meta.height < 32) throw new AvatarError("Images must be at least 32×32 pixels.");
  // EXIF orientations 5–8 swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const w = swap ? meta.height : meta.width;
  const h = swap ? meta.width : meta.height;
  const side = Math.min(w, h);
  let region = { left: Math.floor((w - side) / 2), top: Math.floor((h - side) / 2), width: side, height: side };
  if (crop) {
    const size = Math.round(Math.min(1, Math.max(0.02, crop.size)) * Math.min(w, h));
    const left = Math.round(Math.min(Math.max(0, crop.x), 1) * w);
    const top = Math.round(Math.min(Math.max(0, crop.y), 1) * h);
    region = { left: Math.min(left, w - size), top: Math.min(top, h - size), width: size, height: size };
    region.left = Math.max(0, region.left);
    region.top = Math.max(0, region.top);
  }
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .extract(region)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .flatten({ background: "#1c1c1f" })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new AvatarError("That image couldn't be processed. Try another file.");
  }
}

export function photoUrlFor(playerId: string, version: number): string {
  return `/api/avatar/${playerId}?v=${version}`;
}

/** Stores a processed picture for the given player and returns the new public URL. */
export async function saveAvatar(playerId: string, webp: Buffer): Promise<string> {
  const data = new Uint8Array(webp);
  const row = await db.avatarImage.upsert({
    where: { playerId },
    create: { playerId, data, version: 1 },
    update: { data, version: { increment: 1 } },
    select: { version: true },
  });
  const url = photoUrlFor(playerId, row.version);
  await db.player.update({ where: { id: playerId }, data: { photoUrl: url } });
  return url;
}

export async function removeAvatar(playerId: string): Promise<void> {
  await db.$transaction([db.avatarImage.deleteMany({ where: { playerId } }), db.player.update({ where: { id: playerId }, data: { photoUrl: null } })]);
}
