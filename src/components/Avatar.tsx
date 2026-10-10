"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

/**
 * A player's avatar: their uploaded picture when there is one, otherwise their emoji on a quiet tint of
 * their colour. A picture that fails to load falls back to the emoji instead of a broken image.
 */
export function Avatar({ avatar, photo, color, size = 40, ring, dim, alt }: { avatar: string; photo?: string | null; color: string; size?: number; ring?: boolean; dim?: boolean; alt?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const src = photo ?? (/^(\/|https?:|data:image\/)/.test(avatar) ? avatar : null);
  const showPhoto = !!src && !failed;
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full select-none transition-[opacity,filter] duration-200 ${dim ? "opacity-40 grayscale" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: showPhoto ? "var(--color-surface-3)" : `color-mix(in oklab, ${color} 22%, var(--color-surface-2))`,
        boxShadow: ring ? `0 0 0 2px var(--color-canvas), 0 0 0 3.5px ${color}` : "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
      }}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    >
      {showPhoto ? (
        <img src={src!} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span className="leading-none">{avatar}</span>
      )}
    </span>
  );
}
