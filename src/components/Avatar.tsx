export function Avatar({ avatar, color, size = 40, ring, dim }: { avatar: string; color: string; size?: number; ring?: boolean; dim?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full select-none ${ring ? "ring-2 ring-offset-2 ring-offset-ink-900" : ""} ${dim ? "opacity-40 grayscale" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.55, background: `radial-gradient(circle at 30% 30%, ${color}55, ${color}22)`, boxShadow: `inset 0 0 0 1.5px ${color}88`, ["--tw-ring-color" as string]: color }}
      aria-hidden
    >
      {avatar}
    </span>
  );
}
