"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameInfo } from "@/engine/registry";
import { api } from "@/client/api";
import { emit } from "@/client/socket";
import { Avatar } from "@/components/Avatar";
import { GameGlyph } from "@/components/ui/GameGlyph";
import { Icon } from "@/components/ui/Icon";
import type { RoomSettings, RoomSnapshot } from "./types";

const MODES: { id: RoomSettings["mode"]; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "Everyone for themselves." },
  { id: "teams", label: "Teams", desc: "Team scores are added together." },
  { id: "survival", label: "Survival", desc: "Wrong answers cost lives. Last one standing wins." },
  { id: "chaos", label: "Chaos", desc: "A random twist every round." },
  { id: "ranked", label: "Ranked", desc: "Standard rules. Ratings change." },
  { id: "tournament", label: "Tournament", desc: "Several games; the lowest score is knocked out after each." },
];
const TEAM_NAMES = ["Red", "Blue", "Green", "Gold"];
export const TEAM_COLORS = ["#f27a6f", "#8fb3ff", "#8fcf7f", "#e8cf6a"];

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
  const availableModes = game?.modes.filter((m) => m.available) ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="flex flex-col gap-6">
        {/* Invite */}
        <section className="card p-6" aria-label="Invite">
          <div className="label">Room code</div>
          <div className="mt-3 grid grid-cols-5 gap-2" aria-label={state.code.split("").join(" ")}>
            {state.code.split("").map((c, i) => (
              <span key={i} className="grid h-16 place-items-center rounded-[var(--radius-md)] bg-surface-2 font-mono text-[32px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)] sm:h-[72px] sm:text-4xl">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {}
              }}
            >
              <Icon name={copied ? "check" : "link"} size={16} className={copied ? "text-good-400" : ""} />
              {copied ? "Link copied" : "Copy invite link"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button className="btn-ghost w-11 px-0" aria-label="Share invite" onClick={() => void navigator.share({ title: "Join my PartyVerse room", url: link }).catch(() => undefined)}>
                <Icon name="share" size={17} />
              </button>
            )}
          </div>
        </section>

        {/* Players */}
        <section className="card p-6" aria-labelledby="players">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="players" className="text-[15px] font-semibold text-fg">
              Players <span className="num ml-1 font-normal text-fg-3">{players.length} of {s.maxPlayers}</span>
            </h2>
            {mePlayer && (
              <button className="text-[13px] text-fg-3 transition-colors hover:text-fg" onClick={() => void emit("room:spectate", { spectator: !mePlayer.spectator }).then((r) => setErr(r.error ?? null))}>
                {mePlayer.spectator ? "Join as a player" : "Watch instead"}
              </button>
            )}
          </div>
          {s.mode === "teams" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: s.teamCount }, (_, t) => (
                <div key={t} className="rounded-[var(--radius-md)] bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                      <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[t] }} />
                      {TEAM_NAMES[t]}
                    </span>
                    {mePlayer && !mePlayer.spectator && mePlayer.team !== t && (
                      <button className="text-[13px] text-fg-3 hover:text-fg" onClick={() => void emit("room:team", { team: t })}>
                        Join
                      </button>
                    )}
                  </div>
                  <PlayerList state={state} me={me} filter={(p) => p.team === t && !p.spectator} isHost={isHost} />
                </div>
              ))}
              {isHost && (
                <button className="btn-quiet btn-sm sm:col-span-2" onClick={() => void emit("room:shuffle-teams")}>
                  <Icon name="shuffle" size={15} />
                  Shuffle teams
                </button>
              )}
            </div>
          ) : (
            <PlayerList state={state} me={me} filter={(p) => !p.spectator} isHost={isHost} />
          )}
          {state.players.some((p) => p.spectator) && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="label mb-2">Watching</div>
              <PlayerList state={state} me={me} filter={(p) => p.spectator} isHost={isHost} />
            </div>
          )}
          {players.length < 2 && <p className="mt-4 text-sm leading-relaxed text-fg-3">Share the code to bring friends in. You can also start on your own.</p>}
        </section>
      </div>

      {/* Settings */}
      <section className="card flex flex-col" aria-labelledby="settings">
        <div className="flex items-baseline justify-between px-6 pt-6">
          <h2 id="settings" className="text-[15px] font-semibold text-fg">
            Game
          </h2>
          {!isHost && (
            <span className="flex items-center gap-1.5 text-[13px] text-fg-3">
              <Icon name="lock" size={14} />
              The host picks
            </span>
          )}
        </div>

        <div className="px-6 pt-4">
          <div role="radiogroup" aria-label="Game" className="grid max-h-[288px] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
            {games.map((g) => (
              <button key={g.slug} role="radio" aria-checked={g.slug === s.gameSlug} disabled={!isHost} onClick={() => void set({ gameSlug: g.slug })} className="option flex items-center gap-3 px-2.5 py-2 text-sm">
                <GameGlyph slug={g.slug} group={g.group} name={g.name} size={30} />
                <span className="truncate font-medium">{g.name}</span>
              </button>
            ))}
            {!games.length && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[46px]" />)}
          </div>
        </div>

        {game && s.mode !== "ranked" && s.mode !== "tournament" && availableModes.length > 1 && (
          <div className="px-6 pt-5">
            <button className="flex w-full items-center justify-between text-sm" onClick={() => setShowModes((x) => !x)} aria-expanded={showModes}>
              <span className="text-fg-2">
                Question types <span className="text-fg-3">· {s.modes?.length ? `${s.modes.length} selected` : "all mixed"}</span>
              </span>
              <Icon name="chevron-down" size={16} className={`text-fg-3 transition-transform duration-200 ${showModes ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {showModes && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pt-3">
                    {availableModes.map((m) => {
                      const on = !!s.modes?.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          title={m.description}
                          disabled={!isHost}
                          aria-pressed={on}
                          onClick={() => void set({ modes: on ? (s.modes ?? []).filter((x) => x !== m.id) : [...(s.modes ?? []), m.id] })}
                          className="option rounded-[var(--radius-xs)] px-2.5 py-1 text-[13px]"
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-6 border-t border-line px-6 pt-5">
          <div className="label mb-2.5">Match</div>
          <div role="radiogroup" aria-label="Match type" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={m.id === s.mode} disabled={!isHost} title={m.desc} onClick={() => void set({ mode: m.id })} className="option px-3 py-2.5">
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {s.mode === "tournament" && (
          <div className="px-6 pt-5">
            <div className="label mb-2.5">Tournament games {s.tournamentGames.length ? `· ${s.tournamentGames.length}` : "· 3 at random"}</div>
            <div className="flex flex-wrap gap-1.5">
              {games.map((g) => {
                const on = s.tournamentGames.includes(g.slug);
                return (
                  <button
                    key={g.slug}
                    disabled={!isHost || (!on && s.tournamentGames.length >= 5)}
                    aria-pressed={on}
                    onClick={() => void set({ tournamentGames: on ? s.tournamentGames.filter((x) => x !== g.slug) : [...s.tournamentGames, g.slug] })}
                    className="option rounded-[var(--radius-xs)] px-2.5 py-1 text-[13px]"
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-line px-6 pt-5">
          <div className="label mb-2.5">Rules</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {s.mode !== "survival" && s.mode !== "ranked" && <NumberSetting label={s.mode === "tournament" ? "Rounds per stage" : "Rounds"} value={s.rounds} min={3} max={s.mode === "tournament" ? 8 : 30} disabled={!isHost} onChange={(v) => void set({ rounds: v })} />}
            {s.mode !== "ranked" && (
              <SelectSetting
                label="Time per round"
                value={String(s.timeLimitSec ?? "")}
                disabled={!isHost}
                options={[["", "Game default"], ["10", "10 seconds"], ["15", "15 seconds"], ["20", "20 seconds"], ["30", "30 seconds"], ["45", "45 seconds"], ["60", "60 seconds"]]}
                onChange={(v) => void set({ timeLimitSec: v ? Number(v) : null })}
              />
            )}
            {s.mode === "survival" && <NumberSetting label="Lives" value={s.lives} min={1} max={5} disabled={!isHost} onChange={(v) => void set({ lives: v })} />}
            {s.mode === "teams" && <NumberSetting label="Teams" value={s.teamCount} min={2} max={4} disabled={!isHost} onChange={(v) => void set({ teamCount: v })} />}
            <NumberSetting label="Max players" value={s.maxPlayers} min={2} max={12} disabled={!isHost} onChange={(v) => void set({ maxPlayers: v })} />
            <NumberSetting label="Answer reveal (s)" value={s.revealSec} min={3} max={30} disabled={!isHost} onChange={(v) => void set({ revealSec: v })} />
            <SelectSetting
              label="Game Master"
              value={s.gameMaster}
              disabled={!isHost || !s.chat}
              options={[["classic", "Classic host"], ...(state.aiHostAvailable || s.gameMaster === "ai" ? [["ai", "AI host"] as [string, string]] : []), ["off", "Off"]]}
              onChange={(v) => void set({ gameMaster: v as RoomSettings["gameMaster"] })}
            />
          </div>
          <div className="mt-4 flex flex-col">
            <Toggle label="Public room" hint="Listed on the Party page" value={!s.isPrivate} disabled={!isHost} onChange={(v) => void set({ isPrivate: !v })} />
            <Toggle label="Chat" value={s.chat} disabled={!isHost} onChange={(v) => void set({ chat: v })} />
            <Toggle label="Spectators" value={s.allowSpectators} disabled={!isHost} onChange={(v) => void set({ allowSpectators: v })} />
            <Toggle label="Join mid-game" value={s.allowLateJoin} disabled={!isHost} onChange={(v) => void set({ allowLateJoin: v })} />
            {s.mode !== "ranked" && <Toggle label="Hints and extra clues" value={s.hints} disabled={!isHost} onChange={(v) => void set({ hints: v })} />}
          </div>
        </div>

        <div className="sticky bottom-0 mt-auto rounded-b-[var(--radius-lg)] border-t border-line bg-surface-1 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {err && (
            <p role="alert" className="mb-3 text-sm text-bad-400">
              {err}
            </p>
          )}
          {isHost ? (
            <button
              className="btn-primary btn-lg w-full"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                const r = await emit("room:start");
                setErr(r.error ?? null);
                setStarting(false);
              }}
            >
              <Icon name="play" size={15} />
              {starting ? "Starting" : `Start ${game ? game.name : "game"}`}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-fg-3">
              <span className="spinner h-3.5 w-3.5 border-[1.5px]" />
              Waiting for the host to start
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PlayerList({ state, me, filter, isHost }: { state: RoomSnapshot; me: string; filter: (p: RoomSnapshot["players"][number]) => boolean; isHost: boolean }) {
  const [menu, setMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);
  const list = state.players.filter(filter);
  const act = (ev: string, payload: Record<string, unknown>) => void emit(ev, payload).then(() => setMenu(null));
  return (
    <ul className="flex flex-col">
      <AnimatePresence initial={false}>
        {list.map((p) => (
          <motion.li key={p.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="relative flex items-center gap-3 rounded-[var(--radius-sm)] px-1 py-2">
            <Avatar avatar={p.avatar} color={p.color} size={32} dim={!p.connected} />
            <span className="min-w-0 flex-1 truncate font-medium text-fg">
              {p.name}
              {p.id === me && <span className="ml-2 text-xs font-normal text-fg-3">You</span>}
            </span>
            {p.isHost && (
              <span className="flex items-center gap-1 text-xs text-fg-3" title="Host">
                <Icon name="crown" size={14} className="text-accent" />
                Host
              </span>
            )}
            {!p.connected && <span className="text-xs text-fg-3">Offline</span>}
            {isHost && p.id !== me && (
              <button className="btn-icon h-8 min-h-8 w-8" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label={`Options for ${p.name}`} aria-expanded={menu === p.id}>
                <Icon name="more" size={18} />
              </button>
            )}
            <AnimatePresence>
              {menu === p.id && (
                <motion.div ref={menuRef} initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.14 }} role="menu" className="popover absolute top-full right-0 z-20 mt-1 flex w-48 origin-top-right flex-col p-1 text-sm">
                  <MenuItem onClick={() => act("room:host", { playerId: p.id })}>Make host</MenuItem>
                  <MenuItem onClick={() => act("room:mute", { playerId: p.id, minutes: 10 })}>Mute for 10 minutes</MenuItem>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem danger onClick={() => act("room:kick", { playerId: p.id })}>
                    Remove
                  </MenuItem>
                  <MenuItem danger onClick={() => act("room:kick", { playerId: p.id, ban: true })}>
                    Ban from room
                  </MenuItem>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        ))}
      </AnimatePresence>
      {!list.length && <li className="py-2 text-[13px] text-fg-3">Nobody yet</li>}
    </ul>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" className={`rounded-[6px] px-3 py-2 text-left transition-colors hover:bg-surface-4 ${danger ? "text-bad-400" : "text-fg"}`} onClick={onClick}>
      {children}
    </button>
  );
}

function NumberSetting({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-fg-3">{label}</span>
      <div className="flex h-10 items-center rounded-[var(--radius-sm)] bg-surface-2 p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-[6px] text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg disabled:opacity-30" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Icon name="minus" size={15} />
        </button>
        <span className="num flex-1 text-center font-medium text-fg">{value}</span>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-[6px] text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg disabled:opacity-30" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          <Icon name="plus" size={15} />
        </button>
      </div>
    </div>
  );
}

function SelectSetting({ label, value, options, disabled, onChange }: { label: string; value: string; options: [string, string][]; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-fg-3">{label}</span>
      <span className="relative">
        <select className="input min-h-10 appearance-none py-2 pr-8 text-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={15} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-3" />
      </span>
    </label>
  );
}

function Toggle({ label, hint, value, disabled, onChange }: { label: string; hint?: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} disabled={disabled} onClick={() => onChange(!value)} className="flex items-center justify-between gap-4 border-t border-line py-3 text-left first:border-t-0 disabled:cursor-default">
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-xs text-fg-3">{hint}</span>}
      </span>
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${value ? "bg-accent" : "bg-surface-4"} ${disabled ? "opacity-60" : ""}`}>
        <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.4)] transition-[left,background-color] duration-200 ease-out ${value ? "left-[18px] bg-accent-ink" : "left-[2px] bg-fg-2"}`} />
      </span>
    </button>
  );
}
