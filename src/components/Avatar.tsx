/* eslint-disable @next/next/no-img-element */
/** A player's avatar: an uploaded picture when there is one, otherwise their emoji on a quiet tint of their colour. */
export function Avatar({ avatar, color, size = 40, ring, dim }: { avatar: string; color: string; size?: number; ring?: boolean; dim?: boolean }) {
  const isImage = /^(\/|https?:|data:image\/)/.test(avatar);
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full select-none transition-[opacity,filter] duration-200 ${dim ? "opacity-40 grayscale" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `color-mix(in oklab, ${color} 22%, var(--color-surface-2))`,
        boxShadow: ring ? `0 0 0 2px var(--color-canvas), 0 0 0 3.5px ${color}` : "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
      }}
      aria-hidden
    >
      {isImage ? <img src={avatar} alt="" width={size} height={size} className="h-full w-full object-cover" draggable={false} /> : <span className="leading-none">{avatar}</span>}
    </span>
  );
}
