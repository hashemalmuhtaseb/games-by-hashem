import sharp from "sharp";
import * as FLAG_SVGS from "country-flag-icons/string/3x2";
import type { FlagRender } from "@/engine/types";
import { singleton } from "./globals";

const cache = singleton("renderCache", () => new Map<string, Buffer>());

/** Renders a flag server-side (crop / blur / pixelate) so hidden parts never reach the browser. */
export async function renderFlag(iso2: string, o: FlagRender): Promise<Buffer | null> {
  const svg = (FLAG_SVGS as unknown as Record<string, string>)[iso2];
  if (!svg) return null;
  const key = `${iso2}|${JSON.stringify(o)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const width = Math.min(800, o.width ?? 480);
  const height = Math.round((width * 2) / 3);
  let img = sharp(Buffer.from(svg), { density: 300 }).resize(width, height, { fit: "fill" });
  if (o.crop) {
    const left = Math.round(o.crop.x * width);
    const top = Math.round(o.crop.y * height);
    const w = Math.max(8, Math.round(o.crop.w * width));
    const h = Math.max(8, Math.round(o.crop.h * height));
    img = sharp(await img.png().toBuffer()).extract({ left, top, width: Math.min(w, width - left), height: Math.min(h, height - top) }).resize(width >= 400 ? 400 : width, width >= 400 ? 400 : width, { fit: "fill" });
  }
  if (o.pixelate) {
    const buf = await img.png().toBuffer();
    const meta = await sharp(buf).metadata();
    img = sharp(await sharp(buf).resize(o.pixelate, null, { kernel: "nearest" }).png().toBuffer()).resize(meta.width, meta.height, { kernel: "nearest" });
  }
  if (o.blur && o.blur > 0.3) img = sharp(await img.png().toBuffer()).blur(o.blur);
  if (o.grayscale) img = img.grayscale();
  const out = await img.png({ compressionLevel: 8 }).toBuffer();
  if (cache.size > 3000) cache.clear();
  cache.set(key, out);
  return out;
}
