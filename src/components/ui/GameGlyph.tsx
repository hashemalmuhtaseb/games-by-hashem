/**
 * Each game's mark: a line glyph drawn on the same 24px grid as the interface icons, set on a tile
 * tinted with its family tone. Families keep the library calm; glyphs keep every game recognisable.
 */
import type { CSSProperties, ReactNode } from "react";

const TONES: Record<string, string> = {
  trivia: "var(--color-tone-trivia)",
  visual: "var(--color-tone-visual)",
  words: "var(--color-tone-words)",
  sports: "var(--color-tone-sports)",
  party: "var(--color-tone-party)",
  cards: "var(--color-tone-cards)",
  medicine: "var(--color-tone-medicine)",
};

/** Family for a game: its catalogue group, with a few games pulled into a better-fitting family. */
export function gameFamily(slug: string, group?: string): string {
  if (/poker|hold-?em|cards/.test(slug)) return "cards";
  if (/medic|diagnos|patient|mystery-case|clinic/.test(slug)) return "medicine";
  return group && TONES[group] ? group : "trivia";
}

export function toneOf(slug: string, group?: string): string {
  return TONES[gameFamily(slug, group)];
}

const c = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} />;

const GLYPHS: Record<string, ReactNode> = {
  flags: <path d="M5.5 21V3.5M5.5 4.5c2.5-1.3 4.5-1.3 6.5 0s4 1.3 6.5 0v8.5c-2.5 1.3-4.5 1.3-6.5 0s-4-1.3-6.5 0" />,
  movies: (
    <>
      <path d="M3.5 10.5h17v8A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-8Z" />
      <path d="m3.5 10.5-.6-2.9a1.5 1.5 0 0 1 1.2-1.8l13.7-2.6a1.5 1.5 0 0 1 1.8 1.2l.5 2.6-16.6 3.5ZM8 5.6l2.6 3.5M13.5 4.5l2.6 3.5" />
    </>
  ),
  football: (
    <>
      {c(12, 12, 9)}
      <path d="m12 8.2 3.4 2.5-1.3 4h-4.2l-1.3-4L12 8.2ZM12 8.2V3M15.4 10.7l4.9-1.6M14.1 14.7l3 4.2M9.9 14.7l-3 4.2M8.6 10.7 3.7 9.1" />
    </>
  ),
  "rare-words": <path d="M7 4h10l4 5.5L12 20.5 3 9.5 7 4ZM3 9.5h18M8.5 9.5 12 20.5l3.5-11M7 4l1.5 5.5L12 4l3.5 5.5L17 4" />,
  celebrities: <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />,
  roulette: (
    <>
      {c(12, 12, 9)}
      {c(12, 12, 2.5)}
      <path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21M5.6 5.6l4.6 4.6M13.8 13.8l4.6 4.6M18.4 5.6l-4.6 4.6M10.2 13.8l-4.6 4.6" />
    </>
  ),
  quickfire: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  songs: (
    <>
      <path d="M9 18V5.5l11-2.2v12.5" />
      {c(6.5, 18, 2.5)}
      {c(17.5, 15.8, 2.5)}
    </>
  ),
  "word-chain": <path d="M9.5 14.5a3.5 3.5 0 0 0 4.95 0l3.54-3.54a3.5 3.5 0 0 0-4.95-4.95l-1.06 1.06M14.5 9.5a3.5 3.5 0 0 0-4.95 0l-3.54 3.54a3.5 3.5 0 0 0 4.95 4.95l1.06-1.06" />,
  "category-battle": (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="m8.5 16.5 3.5-9 3.5 9M9.8 13.3h4.4" />
    </>
  ),
  "higher-lower": <path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4" />,
  emoji: (
    <>
      {c(12, 12, 9)}
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5" />
    </>
  ),
  "who-am-i": (
    <>
      {c(12, 8, 4)}
      <path d="M4.5 20.5c.6-3.8 3.7-6 7.5-6s6.9 2.2 7.5 6" />
    </>
  ),
  "odd-one-out": (
    <>
      {c(7, 7, 3)}
      {c(17, 7, 3)}
      {c(7, 17, 3)}
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  "guess-the-year": (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10ZM4 10h16M8.5 3v4M15.5 3v4" />
      <path d="M9 13.5h1.5v4M13.5 13.5h2l-1.5 4" />
    </>
  ),
  connections: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  memory: (
    <>
      <rect x="3" y="6" width="11" height="14" rx="2" />
      <path d="M8 6V5.5A1.5 1.5 0 0 1 9.5 4h10A1.5 1.5 0 0 1 21 5.5v11a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M8.5 11v4M6.5 13h4" />
    </>
  ),
  blurred: (
    <>
      {c(12, 12, 8.5)}
      <path d="M12 3.5v17M7 5.2v13.6M17 5.2v13.6M3.5 12h0" strokeDasharray="1.5 2.5" />
    </>
  ),
  "two-truths": <path d="M10 6.5h10M10 12h10M10 17.5h10M3.5 6.5l1.5 1.5 2.5-3M3.5 12l1.5 1.5 2.5-3M4 16l3 3M7 16l-3 3" />,
  "name-five": <path d="M5.5 5v14M9.5 5v14M13.5 5v14M17.5 5v14M3 16.5 20 7.5" />,
  "rank-it": <path d="M3.5 20.5h17M6 20.5v-5M12 20.5V10M18 20.5V4.5" />,
  "map-mystery": (
    <>
      {c(12, 12, 9)}
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  "risk-reward": (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="2.6" />
    </>
  ),
  "speed-sort": <path d="M12 3.5V10l-6 5v5.5M12 10l6 5v5.5M3.5 18 6 20.5 8.5 18M15.5 18l2.5 2.5 2.5-2.5" />,
  "common-ground": (
    <>
      {c(9, 9, 5)}
      {c(15, 9, 5)}
      {c(12, 14.5, 5)}
    </>
  ),
  "closest-wins": (
    <>
      {c(12, 12, 9)}
      {c(12, 12, 5.5)}
      {c(12, 12, 2)}
    </>
  ),
  anagram: <path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" />,
  "letter-drop": <path d="M3.5 19.5h4M10 19.5h4M16.5 19.5h4M12 3.5v9M8.5 9 12 12.5 15.5 9" />,
  "hive-mind": (
    <>
      <path d="M12 2.8 19.5 7v8.6L12 20l-7.5-4.4V7L12 2.8Z" />
      <path d="M12 8.2 15 10v3.6L12 15.4l-3-1.8V10l3-1.8Z" />
    </>
  ),
  "word-forge": <path d="M3.5 8.5h12c0 2.5 2 3.5 5 3.5v2h-7l1 3.5h-8l1-3.5h-4v-5.5ZM8.5 4.5l2 2M13 3.5v2.5M17 4.5l-1.5 2" />,
  poker: <path d="M12 3.5c3 3.8 7.5 6 7.5 10a3.5 3.5 0 0 1-6.3 2.1L14 20.5h-4l.8-4.9A3.5 3.5 0 0 1 4.5 13.5c0-4 4.5-6.2 7.5-10Z" />,
  medicine: <path d="M3 12.5h4l2-5.5 4 11 2.5-6.5H21" />,
};

function glyphFor(slug: string): ReactNode | null {
  if (GLYPHS[slug]) return GLYPHS[slug];
  const fam = gameFamily(slug);
  if (fam === "cards") return GLYPHS.poker;
  if (fam === "medicine") return GLYPHS.medicine;
  return null;
}

export function GameGlyph({ slug, group, name, size = 44, className }: { slug: string; group?: string; name?: string; size?: number; className?: string }) {
  const tone = toneOf(slug, group);
  const g = glyphFor(slug);
  const style: CSSProperties = {
    width: size,
    height: size,
    color: tone,
    background: `color-mix(in oklab, ${tone} 13%, var(--color-surface-2))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone} 18%, transparent)`,
    borderRadius: Math.round(size * 0.27),
  };
  return (
    <span className={`inline-grid shrink-0 place-items-center ${className ?? ""}`} style={style} aria-hidden>
      {g ? (
        <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          {g}
        </svg>
      ) : (
        <span className="display font-semibold" style={{ fontSize: size * 0.36 }}>
          {(name ?? slug).replace(/^(guess the|the)\s+/i, "").slice(0, 2)}
        </span>
      )}
    </span>
  );
}
