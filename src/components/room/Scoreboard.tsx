"use client";
import { motion, LayoutGroup } from "framer-motion";
import { Avatar } from "@/components/Avatar";
import type { PublicPlayer, RoomSnapshot } from "./types";

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export function Scoreboard({ state, me, showAnswered }: { state: RoomSnapshot; me: string; showAnswered?: boolean }) {
  const players = state.players.filter((p) => !p.spectator).sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score);
  const spectators = state.players.filter((p) => p.spectator);
  return (
    <div className="flex flex-col gap-3">
      {state.teams && (
        <div className="grid grid-cols-2 gap-2">
          {state.teams.filter((t) => t.members > 0).map((t) => (
            <div key={t.team} className="rounded-xl px-3 py-2" style={{ background: `${TEAM_COLORS[t.team]}22`, boxShadow: `inset 0 0 0 1px ${TEAM_COLORS[t.team]}55` }}>
              <div className="text-xs font-bold uppercase" style={{ color: TEAM_COLORS[t.team] }}>
                Team {t.name}
              </div>
              <div className="display text-xl font-black text-white tabular-nums">{t.score}</div>
            </div>
          ))}
        </div>
      )}
      <LayoutGroup>
        <ol className="flex flex-col gap-1.5">
          {players.map((p, i) => (
            <PlayerRow key={p.id} p={p} rank={i + 1} me={p.id === me} showAnswered={showAnswered} />
          ))}
        </ol>
      </LayoutGroup>
      {spectators.length > 0 && <div className="text-xs text-ink-400">👀 {spectators.map((s) => s.name).join(", ")}</div>}
    </div>
  );
}

function PlayerRow({ p, rank, me, showAnswered }: { p: PublicPlayer; rank: number; me: boolean; showAnswered?: boolean }) {
  return (
    <motion.li layout transition={{ type: "spring", stiffness: 500, damping: 40 }} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${me ? "bg-brand-500/15 ring-1 ring-brand-500/40" : "bg-white/[0.03]"} ${p.eliminated ? "opacity-50" : ""}`}>
      <span className="w-5 text-center text-xs font-bold text-ink-400">{rank}</span>
      <span className="relative">
        <Avatar avatar={p.avatar} color={p.team !== null ? TEAM_COLORS[p.team] : p.color} size={32} dim={!p.connected} />
        {showAnswered && p.answered && <span className="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-good-500 text-[10px] text-ink-950">✓</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">
          {p.isHost && "👑 "}
          {p.name}
          {p.eliminated && " 💀"}
        </span>
        <span className="flex gap-2 text-xs text-ink-400">
          {p.streak >= 2 && <span className="text-orange-400">🔥{p.streak}</span>}
          {p.lives !== null && <span>{"❤️".repeat(Math.max(0, p.lives))}</span>}
          {!p.connected && <span>offline</span>}
        </span>
      </span>
      {p.lastPoints !== null && p.lastPoints !== 0 && (
        <motion.span key={`${p.score}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`text-xs font-bold ${p.lastPoints > 0 ? "text-good-400" : "text-bad-400"}`}>
          {p.lastPoints > 0 ? "+" : ""}
          {p.lastPoints}
        </motion.span>
      )}
      <span className="display w-14 text-right font-bold text-white tabular-nums">{p.score}</span>
    </motion.li>
  );
}
