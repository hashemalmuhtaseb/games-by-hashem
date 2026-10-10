/**
 * The interface icon set. 24px grid, 1.75 stroke, round joins — drawn for this product so every
 * glyph shares one hand. Emoji are content in PartyVerse (questions, reactions), never chrome.
 */
const PATHS = {
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "arrow-up-right": "M7 17 17 7M8 7h9v9",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-right": "m9 6 6 6-6 6",
  play: "M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  user: "M19 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-7A3.5 3.5 0 0 0 5 18.5V20M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11",
  "volume-off": "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM16.5 9.5l5 5M21.5 9.5l-5 5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  calendar: "M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10ZM4 10h16M8.5 3v4M15.5 3v4",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1.5A2.5 2.5 0 0 0 7.5 10H8M16 6h3v1.5a2.5 2.5 0 0 1-2.5 2.5H16M12 13v4M8.5 20h7M10 17h4",
  chart: "M4 20h16M7 16v-4M12 16V8M17 16v-7",
  star: "m12 4 2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77L12 4Z",
  flame: "M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-.5 1.5-1.2 2.6-2.5 3.5C11.2 7.5 10.5 5 8.5 3c.3 3-2.5 5.5-2.5 9.5a6 6 0 0 0 6 8.5Z",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z",
  link: "M10 14a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-2.83 2.83a4 4 0 0 0 5.66 5.66l1-1",
  share: "M12 15V3.5M8 7.5l4-4 4 4M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18",
  copy: "M9 9.5A1.5 1.5 0 0 1 10.5 8h8A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 17.5v-8ZM15 8V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  crown: "M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8ZM5.5 21h13",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  shuffle: "M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5",
  flag: "M5 21V4M5 4.5h10l-1.5 3.5L15 11.5H5",
  refresh: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  logout: "M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10",
  edit: "M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  lock: "M6.5 11h11A1.5 1.5 0 0 1 19 12.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11ZM8 11V8a4 4 0 0 1 8 0v3",
  bolt: "M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c2.3 2.4 3.5 5.4 3.5 9s-1.2 6.6-3.5 9c-2.3-2.4-3.5-5.4-3.5-9S9.7 5.4 12 3Z",
  pause: "M8 5v14M16 5v14",
  backspace: "M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7 6-7ZM12 9.5l5 5M17 9.5l-5 5",
  spectate: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  chat: "M5.5 18.5 4 21l4-1.5h9.5A2.5 2.5 0 0 0 20 17V7.5A2.5 2.5 0 0 0 17.5 5h-11A2.5 2.5 0 0 0 4 7.5V17",
  sparkle: "M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5Z",
  skull: "M12 3a7.5 7.5 0 0 0-4.5 13.5V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2.5A7.5 7.5 0 0 0 12 3ZM9 12h.01M15 12h.01M10.5 20v-2M13.5 20v-2",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, strokeWidth = 1.75, title }: { name: IconName; size?: number; className?: string; strokeWidth?: number; title?: string }) {
  const filled = name === "play";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={name === "more" || name === "grip" ? 3 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
