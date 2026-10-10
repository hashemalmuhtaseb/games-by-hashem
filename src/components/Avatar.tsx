"use client";
import { useEffect, useState } from "react";

/**
 * A player's avatar: their uploaded picture when they have one, otherwise their emoji on a tinted
 * disc. If the picture fails to load (deleted, offline), it falls back to the emoji instead of
 * showing a broken image.
 */
export function Avatar({ avatar, photo, color, size = 40, ring, dim, alt }: { avatar: string; photo?: string | null; color: string; size?: number; ring?: boolean; dim?: boolean; alt?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const showPhoto = !!photo && !failed;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none ${ring ? "ring-2 ring-offset-2 ring-offset-ink-900" : ""} ${dim ? "opacity-40 grayscale" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: showPhoto ? "#1c1c1f" : `radial-gradient(circle at 30% 25%, ${color}66, ${color}22 70%)`,
        boxShadow: `inset 0 0 0 1.5px ${color}88`,
        ["--tw-ring-color" as string]: color,
      }}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo!} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : (
        avatar
      )}
    </span>
  );
}
