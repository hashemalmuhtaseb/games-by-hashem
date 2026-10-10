"use client";
import { motion, LayoutGroup } from "framer-motion";
import { Avatar } from "@/components/Avatar";
import { CountUp } from "@/components/ui/CountUp";
import { Icon } from "@/components/ui/Icon";
import { TEAM_COLORS } from "./Lobby";
import type { PublicPlayer, RoomSnapshot } from "./types";

export function Scoreboard({ state, me, showAnswered }: { state: RoomSnapshot; me: string; showAnswered?: boolean }) {
  const players = state.players.filter((p) => !p.spectator).sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score);
  const spectators = state.players.filter((p) => p.spectator);
  return (
    <div className="flex flex-col gap-3">
      {state.teams && (
        <div className="grid grid-cols-2 gap-1.5">
          {state.teams
            .filter((t) => t.members > 0)
            .map((t) => (
              <div key={t.team} className="well px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-fg-3">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAM_COLORS[t.team] }} />
                  {t.name}
                </div>
                <CountUp value={t.score} className="display num block text-lg font-semibold text-fg" />
              </div>
            ))}
        </div>
      )}
      <LayoutGroup>
        <ol className="flex flex-col">
          {players.map((p, i) => (
            <PlayerRow key={p.id} p={p} rank={i + 1} me={p.id === me} showAnswered={showAnswered} />
          ))}
        </ol>
      </LayoutGroup>
      {spectators.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 text-xs text-fg-3">
          <Icon name="eye" size={13} />
          {spectators.map((s) => s.name).join(", ")}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ p, rank, me, showAnswered }: { p: PublicPlayer; rank: number; me: boolean; showAnswered?: boolean }) {
  return (
    <motion.li layout transition={{ layout: { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] } }} className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 ${me ? "bg-accent-soft" : ""} ${p.eliminated ? "opacity-45" : ""}`}>
      <span className={`num w-4 text-center font-mono text-xs ${rank === 1 && !p.eliminated ? "text-accent" : "text-fg-3"}`}>{rank}</span>
      <span className="relative">
        <Avatar avatar={p.avatar} color={p.team !== null ? TEAM_COLORS[p.team] : p.color} size={30} dim={!p.connected} />
        {showAnswered && p.answered && (
          <span className="absolute -right-0.5 -bottom-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-good-400 text-canvas shadow-[0_0_0_2px_var(--color-surface-1)]">
            <Icon name="check" size={9} strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-sm font-medium text-fg">
          <span className="truncate">{p.name}</span>
          {p.isHost && <Icon name="crown" size={12} className="shrink-0 text-fg-3" />}
          {p.eliminated && <span className="text-xs font-normal text-fg-3">· out</span>}
        </span>
        {(p.streak >= 2 || p.lives !== null || !p.connected) && (
          <span className="num flex items-center gap-2 text-[11px] text-fg-3">
            {p.streak >= 2 && (
              <span className="flex items-center gap-0.5 text-warn-400">
                <Icon name="flame" size={11} />
                {p.streak}
              </span>
            )}
            {p.lives !== null && (
              <span className="flex gap-0.5">
                {Array.from({ length: Math.max(0, p.lives) }, (_, i) => (
                  <Icon key={i} name="heart" size={10} className="fill-bad-400 text-bad-400" />
                ))}
              </span>
            )}
            {!p.connected && <span>Offline</span>}
          </span>
        )}
      </span>
      {p.lastPoints !== null && p.lastPoints !== 0 && (
        <motion.span key={`${p.score}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`num text-xs font-medium ${p.lastPoints > 0 ? "text-good-400" : "text-bad-400"}`}>
          {p.lastPoints > 0 ? "+" : "−"}
          {Math.abs(p.lastPoints)}
        </motion.span>
      )}
      <CountUp value={p.score} className="display num w-12 text-right text-sm font-semibold text-fg" />
    </motion.li>
  );
}
