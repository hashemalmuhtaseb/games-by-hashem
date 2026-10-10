"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { GameInfo } from "@/engine/registry";
import { api } from "@/client/api";
import { emit } from "@/client/socket";
import { Avatar } from "@/components/Avatar";
import type { RoomSettings, RoomSnapshot } from "./types";

const MODES: { id: RoomSettings["mode"]; label: string; desc: string }[] = [
  { id: "classic", label: "🎯 Classic", desc: "Everyone for themselves." },
  { id: "teams", label: "🤝 Teams", desc: "Team scores are summed." },
  { id: "survival", label: "❤️ Survival", desc: "Wrong answers cost lives. Last one standing wins." },
  { id: "chaos", label: "🌀 Chaos", desc: "Random twists every round." },
  { id: "ranked", label: "🏆 Ranked", desc: "Standard rules; ratings change." },
  { id: "tournament", label: "🏟️ Tournament", desc: "Several games in a row; lowest score is knocked out after each stage." },
];
const TEAM_NAMES = ["Red", "Blue", "Green", "Gold"];
const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export function Lobby({ state, me }: { state: RoomSnapshot; me: string }) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const isHost = state.hostId === me;
  const s = state.settings;
  const mePlayer = state.players.find((p) => p.id === me);
  const players = state.players.filter((p) => !p.spectator);
  useEffect(() => {
    api<{ games: GameInfo[] }>("/api/games").then((r) => setGames(r.games.filter((g) => g.multiplayer && !g.soloOnly)), () => undefined);
  }, []);
  const game = games.find((g) => g.slug === s.gameSlug);
  const set = async (patch: Partial<RoomSettings>) => {
    const r = await emit("room:settings", patch);
    setErr(r.error ?? null);
  };
  const link = typeof window !== "undefined" ? `${window.location.origin}/room/${state.code}` : "";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <div className="card p-6 text-center">
          <div className="label">Room code</div>
          <div className="display mt-1 font-mono text-6xl font-black tracking-[0.2em] text-white">{state.code}</div>
          <div className="mt-4 flex justify-center gap-2">
            <button
              className="btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
            >
              {copied ? "✓ Link copied" : "🔗 Copy invite link"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button className="btn-ghost" onClick={() => void navigator.share({ title: "Join my PartyVerse room", url: link }).catch(() => undefined)}>
                📤 Share
              </button>
            )}
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label">
              Players {players.length}/{s.maxPlayers}
            </h2>
            {mePlayer && (
              <button className="text-xs text-ink-400 hover:text-white" onClick={() => void emit("room:spectate", { spectator: !mePlayer.spectator }).then((r) => setErr(r.error ?? null))}>
                {mePlayer.spectator ? "Join as player" : "Switch to spectator"}
              </button>
            )}
          </div>
          {s.mode === "teams" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: s.teamCount }, (_, t) => (
                <div key={t} className="rounded-xl p-3" style={{ background: `${TEAM_COLORS[t]}14`, boxShadow: `inset 0 0 0 1px ${TEAM_COLORS[t]}44` }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: TEAM_COLORS[t] }}>
                      Team {TEAM_NAMES[t]}
                    </span>
                    {mePlayer && !mePlayer.spectator && mePlayer.team !== t && (
                      <button className="text-xs text-ink-300 hover:text-white" onClick={() => void emit("room:team", { team: t })}>
                        Join
                      </button>
                    )}
                  </div>
                  <PlayerList state={state} me={me} filter={(p) => p.team === t && !p.spectator} isHost={isHost} />
                </div>
              ))}
              {isHost && (
                <button className="btn-ghost text-sm sm:col-span-2" onClick={() => void emit("room:shuffle-teams")}>
                  🔀 Shuffle teams
                </button>
              )}
            </div>
          ) : (
            <PlayerList state={state} me={me} filter={(p) => !p.spectator} isHost={isHost} />
          )}
          {state.players.some((p) => p.spectator) && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <div className="label mb-2">Spectators</div>
              <PlayerList state={state} me={me} filter={(p) => p.spectator} isHost={isHost} />
            </div>
          )}
          {players.length < 2 && <p className="mt-3 text-center text-sm text-ink-400">Waiting for friends… share the code above. You can also start solo.</p>}
        </div>
      </div>

      <div className="card flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl font-bold text-white">Game settings</h2>
          {!isHost && <span className="chip">Only the host can change these</span>}
        </div>
        <div>
          <div className="label mb-2">Game</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(games.length ? games : []).map((g) => (
              <button
                key={g.slug}
                disabled={!isHost}
                onClick={() => void set({ gameSlug: g.slug })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-default ${g.slug === s.gameSlug ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 bg-white/[0.03] text-ink-300 enabled:hover:border-white/25"}`}
              >
                <span className="text-xl">{g.icon}</span>
                <span className="font-semibold leading-tight">{g.name}</span>
              </button>
            ))}
            {!games.length && <div className="col-span-3 h-24 animate-pulse rounded-xl bg-white/5" />}
          </div>
        </div>
        {game && s.mode !== "ranked" && s.mode !== "tournament" && game.modes.filter((m) => m.available).length > 1 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Modes {s.modes?.length ? `(${s.modes.length} selected)` : "(all mixed)"}</span>
              <button className="text-xs text-brand-400 hover:text-white" onClick={() => setShowModes((x) => !x)}>
                {showModes ? "Hide" : isHost ? "Customise" : "Show"}
              </button>
            </div>
            {showModes && <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
              {game.modes
                .filter((m) => m.available)
                .map((m) => {
                  const on = s.modes?.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      title={m.description}
                      disabled={!isHost}
                      onClick={() => void set({ modes: on ? (s.modes ?? []).filter((x) => x !== m.id) : [...(s.modes ?? []), m.id] })}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-default ${on ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 text-ink-300 enabled:hover:text-white"}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
            </div>}
          </div>
        )}
        <div>
          <div className="label mb-2">Match type</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                disabled={!isHost}
                title={m.desc}
                onClick={() => void set({ mode: m.id })}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-default ${m.id === s.mode ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 bg-white/[0.03] text-ink-300 enabled:hover:border-white/25"}`}
              >
                <div className="font-semibold">{m.label}</div>
                <div className="text-[11px] leading-tight text-ink-400">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {s.mode === "tournament" && (
          <div>
            <div className="label mb-2">Tournament games {s.tournamentGames.length ? `(${s.tournamentGames.length})` : "(3 random)"}</div>
            <div className="flex flex-wrap gap-1.5">
              {games.map((g) => {
                const on = s.tournamentGames.includes(g.slug);
                return (
                  <button
                    key={g.slug}
                    disabled={!isHost || (!on && s.tournamentGames.length >= 5)}
                    onClick={() => void set({ tournamentGames: on ? s.tournamentGames.filter((x) => x !== g.slug) : [...s.tournamentGames, g.slug] })}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 text-ink-300"}`}
                  >
                    {g.icon} {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {s.mode !== "survival" && s.mode !== "ranked" && (
            <NumberSetting label={s.mode === "tournament" ? "Rounds / stage" : "Rounds"} value={s.rounds} min={3} max={s.mode === "tournament" ? 8 : 30} disabled={!isHost} onChange={(v) => void set({ rounds: v })} />
          )}
          {s.mode !== "ranked" && (
            <SelectSetting
              label="Time per round"
              value={String(s.timeLimitSec ?? "")}
              disabled={!isHost}
              options={[["", "Game default"], ["10", "10s"], ["15", "15s"], ["20", "20s"], ["30", "30s"], ["45", "45s"], ["60", "60s"]]}
              onChange={(v) => void set({ timeLimitSec: v ? Number(v) : null })}
            />
          )}
          {s.gameSlug === "risk-reward" && (
            <SelectSetting
              label="Starting chips"
              value={String(s.startingChips)}
              disabled={!isHost}
              options={[...new Set([500, 1000, 2500, 5000, 10000, s.startingChips])].sort((a, b) => a - b).map((n) => [String(n), `${n.toLocaleString()} chips`] as [string, string])}
              onChange={(v) => void set({ startingChips: Number(v) })}
            />
          )}
          {s.mode === "survival" && s.gameSlug !== "risk-reward" && <NumberSetting label="Lives" value={s.lives} min={1} max={5} disabled={!isHost} onChange={(v) => void set({ lives: v })} />}
          {s.mode === "teams" && <NumberSetting label="Teams" value={s.teamCount} min={2} max={4} disabled={!isHost} onChange={(v) => void set({ teamCount: v })} />}
          <NumberSetting label="Max players" value={s.maxPlayers} min={2} max={12} disabled={!isHost} onChange={(v) => void set({ maxPlayers: v })} />
          <NumberSetting label="Reveal (sec)" value={s.revealSec} min={3} max={30} disabled={!isHost} onChange={(v) => void set({ revealSec: v })} />
          <SelectSetting
            label="Game Master"
            value={s.gameMaster}
            disabled={!isHost || !s.chat}
            options={[["classic", "🎙️ Classic host"], ...(state.aiHostAvailable || s.gameMaster === "ai" ? [["ai", "✨ AI host"] as [string, string]] : []), ["off", "Off"]]}
            onChange={(v) => void set({ gameMaster: v as RoomSettings["gameMaster"] })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Toggle label="Public room" value={!s.isPrivate} disabled={!isHost} onChange={(v) => void set({ isPrivate: !v })} />
          <Toggle label="Chat" value={s.chat} disabled={!isHost} onChange={(v) => void set({ chat: v })} />
          <Toggle label="Spectators" value={s.allowSpectators} disabled={!isHost} onChange={(v) => void set({ allowSpectators: v })} />
          <Toggle label="Late joining" value={s.allowLateJoin} disabled={!isHost} onChange={(v) => void set({ allowLateJoin: v })} />
          {s.mode !== "ranked" && <Toggle label="Hints / extra clues" value={s.hints} disabled={!isHost} onChange={(v) => void set({ hints: v })} />}
        </div>
        {err && <p className="text-sm text-bad-400">{err}</p>}
        {isHost ? (
          <button
            className="btn-primary mt-auto py-4 text-lg"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              const r = await emit("room:start");
              setErr(r.error ?? null);
              setStarting(false);
            }}
          >
            {starting ? "Starting…" : `▶ Start ${game ? game.name : "game"}`}
          </button>
        ) : (
          <div className="mt-auto rounded-xl bg-white/[0.04] py-4 text-center text-ink-300">Waiting for the host to start…</div>
        )}
      </div>
    </div>
  );
}

function PlayerList({ state, me, filter, isHost }: { state: RoomSnapshot; me: string; filter: (p: RoomSnapshot["players"][number]) => boolean; isHost: boolean }) {
  const [menu, setMenu] = useState<string | null>(null);
  const list = state.players.filter(filter);
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((p) => (
        <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
          <Avatar avatar={p.avatar} photo={p.photo} color={p.color} size={34} dim={!p.connected} />
          <span className="flex-1 truncate font-semibold text-white">
            {p.name}
            {p.id === me && <span className="ml-1 text-xs text-ink-400">(you)</span>}
          </span>
          {p.isHost && <span title="Host">👑</span>}
          {!p.connected && <span className="text-xs text-ink-400">offline</span>}
          {isHost && p.id !== me && (
            <button className="rounded px-2 text-ink-400 hover:bg-white/10 hover:text-white" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label="Player options">
              ⋯
            </button>
          )}
          {menu === p.id && (
            <div className="absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-xl border border-white/10 bg-ink-800 p-1 text-sm shadow-2xl">
              <button className="rounded-lg px-3 py-1.5 text-left hover:bg-white/10" onClick={() => void emit("room:host", { playerId: p.id }).then(() => setMenu(null))}>
                👑 Make host
              </button>
              <button className="rounded-lg px-3 py-1.5 text-left hover:bg-white/10" onClick={() => void emit("room:mute", { playerId: p.id, minutes: 10 }).then(() => setMenu(null))}>
                🔇 Mute 10 min
              </button>
              <button className="rounded-lg px-3 py-1.5 text-left text-bad-400 hover:bg-white/10" onClick={() => void emit("room:kick", { playerId: p.id }).then(() => setMenu(null))}>
                Remove
              </button>
              <button className="rounded-lg px-3 py-1.5 text-left text-bad-400 hover:bg-white/10" onClick={() => void emit("room:kick", { playerId: p.id, ban: true }).then(() => setMenu(null))}>
                Ban from room
              </button>
            </div>
          )}
        </motion.li>
      ))}
      {!list.length && <li className="py-2 text-center text-xs text-ink-400">Nobody yet</li>}
    </ul>
  );
}

function NumberSetting({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1">
        <button type="button" className="h-8 w-8 rounded-lg hover:bg-white/10 disabled:opacity-30" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="flex-1 text-center font-bold text-white tabular-nums">{value}</span>
        <button type="button" className="h-8 w-8 rounded-lg hover:bg-white/10 disabled:opacity-30" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </label>
  );
}

function SelectSetting({ label, value, options, disabled, onChange }: { label: string; value: string; options: [string, string][]; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select className="input py-2.5" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!value)} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 disabled:cursor-default">
      <span className="text-ink-100">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${value ? "bg-brand-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
