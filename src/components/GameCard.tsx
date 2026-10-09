"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { GameInfo } from "@/engine/registry";

export function GameCard({ g, i = 0 }: { g: GameInfo; i?: number }) {
  const modes = g.modes.filter((m) => m.available).length;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
      <Link
        href={`/games/${g.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850/80 p-5 transition hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl"
        style={{ boxShadow: `0 0 0 0 ${g.accent[0]}` }}
      >
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60" style={{ background: `linear-gradient(135deg, ${g.accent[0]}, ${g.accent[1]})` }} />
        <div className="flex items-start justify-between">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${g.accent[0]}33, ${g.accent[1]}33)`, boxShadow: `inset 0 0 0 1px ${g.accent[0]}55` }}>
            {g.icon}
          </span>
          <div className="flex gap-1">
            {g.original && <span className="chip border-brand-500/40 text-brand-400">Original</span>}
            {g.multiplayer && !g.soloOnly && <span className="chip">👥 Party</span>}
          </div>
        </div>
        <h3 className="display mt-4 text-lg font-bold text-white">{g.name}</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-300">{g.short}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-ink-400">
          <span>{modes} {modes === 1 ? "mode" : "modes"}</span>
          <span>·</span>
          <span>{g.questionCount.toLocaleString()} questions</span>
        </div>
      </Link>
    </motion.div>
  );
}
