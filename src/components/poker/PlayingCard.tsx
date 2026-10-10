"use client";
import { motion } from "framer-motion";

const SUIT: Record<string, { glyph: string; red: boolean; name: string }> = {
  s: { glyph: "♠", red: false, name: "spades" },
  h: { glyph: "♥", red: true, name: "hearts" },
  d: { glyph: "♦", red: true, name: "diamonds" },
  c: { glyph: "♣", red: false, name: "clubs" },
};
const RANK_NAME: Record<string, string> = { A: "Ace", K: "King", Q: "Queen", J: "Jack", T: "10" };

export function cardLabel(code: string): string {
  const r = code.slice(0, -1);
  const s = SUIT[code.slice(-1)];
  return `${RANK_NAME[r] ?? r} of ${s?.name ?? "?"}`;
}

const SIZES = {
  sm: "h-12 w-9 text-sm rounded-md",
  md: "h-16 w-12 text-lg rounded-lg",
  lg: "h-24 w-[4.25rem] text-2xl rounded-xl",
} as const;

/** A playing card. `code` like "Ah", "Td". Face-down cards never receive a code from the server. */
export function PlayingCard({ code, size = "md", faceDown, dim, highlight, delay = 0 }: { code?: string; size?: keyof typeof SIZES; faceDown?: boolean; dim?: boolean; highlight?: boolean; delay?: number }) {
  const cls = SIZES[size];
  if (faceDown || !code)
    return (
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay, duration: 0.25, ease: "easeOut" }}
        className={`${cls} relative shrink-0 border border-white/15 bg-[repeating-linear-gradient(45deg,#1e3a5f_0_6px,#18304f_6px_12px)] shadow-md`}
        aria-label="Face-down card"
        role="img"
      />
    );
  const r = code.slice(0, -1);
  const s = SUIT[code.slice(-1)];
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={`${cls} relative flex shrink-0 flex-col justify-between bg-[#fbfaf7] px-1 py-0.5 font-bold shadow-md select-none ${s?.red ? "text-[#c0263a]" : "text-[#16181d]"} ${dim ? "opacity-35" : ""} ${highlight ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-transparent" : ""}`}
      role="img"
      aria-label={cardLabel(code)}
    >
      <span className="leading-none">{r === "T" ? "10" : r}</span>
      <span className="self-center leading-none" style={{ fontSize: "1.4em" }}>
        {s?.glyph}
      </span>
      <span className="rotate-180 self-end leading-none">{r === "T" ? "10" : r}</span>
    </motion.div>
  );
}
