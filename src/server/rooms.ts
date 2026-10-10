import { maskBlocked } from "@/lib/moderation";
import { gameMasterAiAvailable, gameMasterLine, type GMEvent } from "./game-master";
import { randomBytes } from "node:crypto";
import type { Server as IOServer } from "socket.io";
import { z } from "zod";
import type { Player } from "@prisma/client";
import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import { allGames, getGame } from "@/engine/registry";
import { createRng, randomSeed, shuffle, type Rng } from "@/engine/rng";
import { emptySessionMemory, type HistoryView, type SessionMemory } from "@/engine/selection";
import { applyAction, applyTimeout, newPlayerState } from "@/engine/handlers";
import { mergeScoring } from "@/engine/scoring";
import { applyClosest } from "@/engine/closest";
import { applyNet, chipMatchDecided, chipStandings, DEFAULT_STARTING_CHIPS, MAX_STARTING_CHIPS, MIN_STARTING_CHIPS } from "@/engine/chips";
import type { Action, PlayerRoundState, PublicRound, RevealPayload, Round } from "@/engine/types";
import { loadHistory, recordSeen } from "./history";
import { pickRound, type PickState } from "./picker";
import { prismaRarityStore } from "./rarity-store";
import { buildReveal } from "./reveal";
import { applyGameResult, getSkill, trackEvent, updateRating } from "./progress";
import { gameConfig } from "./game-config";
import { MODIFIERS } from "./solo";

/**
 * Real-time multiplayer rooms. The server is authoritative for everything: question choice,
 * timers, answer validation and scores. Clients only ever receive the public half of a round
 * until the reveal; individual answers are disclosed to the room only at reveal time.
 */

export const ROOM_MODES = ["classic", "teams", "survival", "chaos", "ranked", "tournament"] as const;
export type RoomMode = (typeof ROOM_MODES)[number];
export const TEAM_NAMES = ["Red", "Blue", "Green", "Gold"] as const;
export const REACTIONS = ["👏", "😂", "🔥", "😮", "😭", "🤯", "👀", "💀", "🎉", "🤔"] as const;

export const SettingsSchema = z.object({
  gameSlug: z.string().max(40),
  modes: z.array(z.string().max(60)).max(30).optional(),
  rounds: z.number().int().min(3).max(30),
  timeLimitSec: z.number().int().min(5).max(120).nullable(),
  mode: z.enum(ROOM_MODES),
  teamCount: z.number().int().min(2).max(4),
  isPrivate: z.boolean(),
  maxPlayers: z.number().int().min(2).max(12),
  allowSpectators: z.boolean(),
  allowLateJoin: z.boolean(),
  chat: z.boolean(),
  hints: z.boolean(),
  revealSec: z.number().int().min(3).max(30),
  lives: z.number().int().min(1).max(5),
  tournamentGames: z.array(z.string().max(40)).max(5),
  gameMaster: z.enum(["off", "classic", "ai"]).default("classic"),
  /** Risk & Reward: virtual chips every player starts the match with. */
  startingChips: z.number().int().min(MIN_STARTING_CHIPS).max(MAX_STARTING_CHIPS).default(DEFAULT_STARTING_CHIPS),
});
export type RoomSettings = z.infer<typeof SettingsSchema>;

type Phase = "lobby" | "countdown" | "question" | "reveal" | "stage" | "results";

interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  photo: string | null;
  color: string;
  registered: boolean;
  team: number | null;
  spectator: boolean;
  connected: boolean;
  sockets: Set<string>;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  rounds: number;
  lives: number;
  eliminated: boolean;
  eliminatedAt?: number; // stage/round index, for final ordering
  /** Risk & Reward: chips held before the round this player went bust in (tie-break). */
  balanceBefore?: number;
  qualities: number[];
  maxRarity: number;
  lastPoints: number | null;
  mutedUntil: number;
  joinedAt: number;
  disconnectedAt?: number;
}

interface LiveRound {
  roundId: string;
  round: Round;
  pub: PublicRound;
  states: Map<string, PlayerRoundState>;
  startedAt: number;
  deadline: number;
  modifier?: (typeof MODIFIERS)[number];
  dbRoundId?: string;
  pausedAt?: number;
  reveal?: RevealPayload;
}

interface ChatMsg {
  id: string;
  playerId: string;
  name: string;
  avatar: string;
  photo?: string | null;
  color: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  settings: RoomSettings;
  phase: Phase;
  players: Map<string, RoomPlayer>;
  banned: Set<string>;
  chat: ChatMsg[];
  createdAt: number;
  lastActive: number;
  // game state
  matchId?: string;
  seed?: string;
  rng?: Rng;
  history?: HistoryView;
  memory?: SessionMemory;
  pick?: PickState;
  skill: number;
  index: number; // 0-based round within current stage
  totalRounds: number;
  stage: number; // tournament stage (0-based)
  stageGames: string[];
  live: LiveRound | null;
  /** Who led after the previous reveal, so the Game Master can call lead changes. */
  gmLeader?: string;
  timer?: NodeJS.Timeout;
  phaseEndsAt?: number;
  notice?: string;
  final?: FinalResults;
  ratingsBefore?: Map<string, number>;
  busy?: boolean;
}

export interface RoundResult {
  playerId: string;
  correct: boolean;
  points: number;
  answer?: string;
  breakdown?: PlayerRoundState["breakdown"];
  /** Numeric rounds only. */
  guess?: number | null;
  distance?: number | null;
  closest?: boolean;
  closestRank?: number | null;
  /** Risk & Reward only. */
  stake?: number | null;
  balance?: number;
  eliminated?: boolean;
}

interface FinalResults {
  standings: { playerId: string; name: string; avatar: string; photo: string | null; color: string; team: number | null; score: number; correct: number; rank: number; eliminated: boolean; xp?: number; levelUp?: boolean; achievements?: { name: string; icon: string }[]; rating?: { rating: number; delta: number } }[];
  teams?: { team: number; name: string; score: number; rank: number }[];
  winnerName: string;
}

const rooms = singleton("rooms", () => new Map<string, Room>());
let io: IOServer | null = null;

export function attachIO(server: IOServer) {
  io = server;
  setInterval(sweepRooms, 60_000).unref();
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
function newCode(): string {
  for (;;) {
    const bytes = randomBytes(5);
    const code = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    if (!rooms.has(code)) return code;
  }
}

export function defaultSettings(gameSlug = "roulette"): RoomSettings {
  const g = getGame(gameSlug);
  return {
    gameSlug,
    rounds: g?.rounds ?? 10,
    timeLimitSec: null,
    mode: "classic",
    teamCount: 2,
    isPrivate: true,
    maxPlayers: 12,
    allowSpectators: true,
    allowLateJoin: true,
    chat: true,
    hints: true,
    revealSec: 7,
    lives: 3,
    tournamentGames: [],
    gameMaster: "classic",
    startingChips: DEFAULT_STARTING_CHIPS,
  };
}

export function multiplayerGames() {
  return allGames().filter((g) => g.multiplayer && !g.soloOnly);
}

function sanitizeSettings(s: RoomSettings): RoomSettings {
  const g = getGame(s.gameSlug);
  if (!g || !g.multiplayer || g.soloOnly) throw new Error("That game can't be played in a room.");
  const out = { ...s };
  if (out.modes) {
    out.modes = out.modes.filter((m) => g.modes.some((x) => x.id === m));
    if (!out.modes.length) out.modes = undefined;
  }
  // Chip balances belong to a whole match, so Risk & Reward can't be one stage of a tournament.
  out.tournamentGames = [...new Set(out.tournamentGames)].filter((slug) => slug !== RISK_SLUG && multiplayerGames().some((x) => x.slug === slug));
  if (out.gameSlug === RISK_SLUG && (out.mode === "survival" || out.mode === "tournament")) out.mode = "classic";
  if (out.mode === "ranked") {
    // Ranked is standardised so ratings stay comparable.
    out.modes = undefined;
    out.rounds = g.rounds;
    out.timeLimitSec = null;
    out.hints = false;
  }
  return out;
}

// ───────────────────────── snapshots (client-safe) ─────────────────────────

function publicPlayer(r: Room, p: RoomPlayer) {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    photo: p.photo,
    color: p.color,
    registered: p.registered,
    team: p.team,
    spectator: p.spectator,
    connected: p.connected,
    isHost: r.hostId === p.id,
    score: p.score,
    streak: p.streak,
    correct: p.correct,
    lives: r.settings.mode === "survival" ? p.lives : null,
    chips: isRisk(r) ? p.score : null,
    eliminated: p.eliminated,
    answered: r.phase === "question" && !!r.live?.states.get(p.id)?.done,
    lastPoints: p.lastPoints,
  };
}

export type PublicPlayer = ReturnType<typeof publicPlayer>;

function snapshot(r: Room) {
  const g = getGame(currentGameSlug(r));
  return {
    code: r.code,
    hostId: r.hostId,
    phase: r.phase,
    settings: r.settings,
    aiHostAvailable: gameMasterAiAvailable(),
    game: g ? { slug: g.slug, name: g.name, icon: g.icon, accent: g.accent } : null,
    players: [...r.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => publicPlayer(r, p)),
    index: r.index,
    totalRounds: r.totalRounds,
    stage: r.stage,
    stageGames: r.stageGames.map((slug) => ({ slug, name: getGame(slug)?.name ?? slug, icon: getGame(slug)?.icon ?? "🎲" })),
    phaseEndsAt: r.phaseEndsAt ?? null,
    paused: !!r.live?.pausedAt,
    teams: r.settings.mode === "teams" ? teamScores(r) : null,
    final: r.phase === "results" ? r.final : null,
    serverNow: Date.now(),
  };
}

export type RoomSnapshot = ReturnType<typeof snapshot>;

function roundPayload(r: Room) {
  const l = r.live!;
  return {
    round: l.pub,
    index: r.index,
    total: r.totalRounds,
    stage: r.stage,
    deadline: l.deadline,
    serverNow: Date.now(),
    modifier: l.modifier,
    notice: r.notice,
    paused: !!l.pausedAt,
  };
}

/** What a reconnecting player needs to resume a round mid-way (only info they already earned). */
function resumeFor(r: Room, playerId: string) {
  const l = r.live;
  if (!l) return null;
  const st = l.states.get(playerId);
  if (!st) return null;
  const s = l.round.secret;
  const out: Record<string, unknown> = { done: st.done, points: st.done ? st.points : undefined, correct: st.done ? st.correct : undefined };
  if (l.round.handler === "clues" && s.clues) out.clues = s.clues.slice(0, Math.max(1, st.cluesUsed));
  if (l.round.handler === "reveal" && s.stages) out.stage = s.stages[Math.max(0, st.cluesUsed - 1)];
  if ((l.round.handler === "memory" && st.data.readyAt) || (l.round.handler === "wager" && st.data.bet != null))
    out.reveal = { prompt: s.data?.question, options: s.data?.options };
  if (l.round.handler === "groups") out.found = ((st.data.found as number[]) ?? []).map((i) => s.groups![i]);
  if (l.round.handler === "map") out.guesses = st.data.guesses;
  if (l.round.handler === "multi") out.found = st.data.foundLabels ?? [];
  if (l.round.handler === "case" && st.data.hintUsed) out.hint = (s.data as { hint?: string } | undefined)?.hint;
  if (l.round.handler === "investigate") {
    const unlocked = (st.data.unlocked as string[]) ?? [];
    const sections = (s.data as { sections: Record<string, string[]> }).sections;
    const labels = new Map(((l.pub.extra?.clues as { id: string; label: string }[]) ?? []).map((c) => [c.id, c.label]));
    out.opened = unlocked.map((id) => ({ id, label: labels.get(id) ?? id, items: sections[id] ?? [] }));
    out.spent = st.data.spent;
    out.wrongIds = st.data.wrongIds;
  }
  return out;
}

function teamScores(r: Room) {
  const totals = Array.from({ length: r.settings.teamCount }, (_, i) => ({ team: i, name: TEAM_NAMES[i], score: 0, members: 0 }));
  for (const p of r.players.values()) if (!p.spectator && p.team !== null && totals[p.team]) {
    totals[p.team].score += p.score;
    totals[p.team].members++;
  }
  return totals;
}

function broadcastState(r: Room) {
  io?.to(`room:${r.code}`).emit("room:state", snapshot(r));
}

/** Posts a Game Master line (if the room has a host style and chat on). Never blocks the game. */
function gameMaster(r: Room, ev: GMEvent) {
  if (!r.settings.chat || r.settings.gameMaster === "off") return;
  void gameMasterLine(r.settings.gameMaster, ev, r.rng ?? Math.random)
    .then((line) => {
      if (!line) return;
      const m: ChatMsg = { id: randomBytes(6).toString("base64url"), playerId: "system", name: "Game Master", avatar: "🎙️", color: "#f472b6", text: line.replace(/^🎙️\s*/, ""), at: Date.now(), system: true };
      r.chat.push(m);
      if (r.chat.length > 60) r.chat.shift();
      io?.to(`room:${r.code}`).emit("room:chat", m);
    })
    .catch(() => undefined);
}

function systemChat(r: Room, text: string) {
  const m: ChatMsg = { id: randomBytes(6).toString("base64url"), playerId: "system", name: "PartyVerse", avatar: "🎲", color: "#a78bfa", text, at: Date.now(), system: true };
  r.chat.push(m);
  if (r.chat.length > 60) r.chat.shift();
  io?.to(`room:${r.code}`).emit("room:chat", m);
}

// ───────────────────────── membership ─────────────────────────

const RISK_SLUG = "risk-reward";

/** Risk & Reward matches keep a chip balance per player (stored in `score`). */
function isRisk(r: Room): boolean {
  return r.settings.gameSlug === RISK_SLUG && r.settings.mode !== "tournament";
}

function chipPlayers(r: Room) {
  return [...r.players.values()].filter((p) => !p.spectator).map((p) => ({ id: p.id, balance: p.score, eliminated: p.eliminated, eliminatedAt: p.eliminatedAt, balanceBefore: p.balanceBefore }));
}

function activePlayers(r: Room): RoomPlayer[] {
  return [...r.players.values()].filter((p) => !p.spectator && !p.eliminated);
}

function autoTeam(r: Room): number {
  const counts = teamScores(r).map((t) => t.members);
  return counts.indexOf(Math.min(...counts));
}

function addPlayer(r: Room, pl: Player, registered: boolean, spectator: boolean): RoomPlayer {
  const p: RoomPlayer = {
    id: pl.id, name: pl.displayName, avatar: pl.avatar, photo: pl.photoUrl, color: pl.color, registered,
    team: null, spectator, connected: true, sockets: new Set(), score: 0, streak: 0, bestStreak: 0, correct: 0, rounds: 0,
    lives: r.settings.lives, eliminated: false, qualities: [], maxRarity: 0, lastPoints: null, mutedUntil: 0, joinedAt: Date.now(),
  };
  if (r.settings.mode === "teams" && !spectator) p.team = autoTeam(r);
  r.players.set(p.id, p);
  db.roomParticipant.upsert({ where: { roomId_playerId: { roomId: r.id, playerId: p.id } }, create: { roomId: r.id, playerId: p.id, spectator, team: p.team === null ? null : String(p.team) }, update: { spectator } }).catch(() => undefined);
  return p;
}

export async function createRoom(host: Player, registered: boolean, settings?: Partial<RoomSettings>): Promise<Room> {
  const s = sanitizeSettings({ ...defaultSettings(settings?.gameSlug ?? "roulette"), ...settings } as RoomSettings);
  const code = newCode();
  const row = await db.room.create({ data: { code, hostPlayerId: host.id, settings: s as object } });
  const r: Room = {
    id: row.id, code, hostId: host.id, settings: s, phase: "lobby", players: new Map(), banned: new Set(), chat: [],
    createdAt: Date.now(), lastActive: Date.now(), skill: 0.45, index: -1, totalRounds: s.rounds, stage: 0, stageGames: [], live: null,
  };
  rooms.set(code, r);
  addPlayer(r, host, registered, false);
  await trackEvent("room_created", host.id, s.gameSlug, { mode: s.mode });
  return r;
}

/** Pushes a profile change (name, emoji, picture) to every live room the player is in, immediately. */
export function refreshPlayerEverywhere(playerId: string, patch: { photo?: string | null; avatar?: string; name?: string; color?: string }) {
  for (const r of rooms.values()) {
    const p = r.players.get(playerId);
    if (!p) continue;
    if (patch.photo !== undefined) p.photo = patch.photo;
    if (patch.avatar !== undefined) p.avatar = patch.avatar;
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.color !== undefined) p.color = patch.color;
    broadcastState(r);
  }
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(r: Room, pl: Player, registered: boolean, wantSpectator: boolean, socketId: string): { player: RoomPlayer; error?: undefined } | { error: string } {
  if (r.banned.has(pl.id)) return { error: "You were removed from this room." };
  let p = r.players.get(pl.id);
  if (!p) {
    const playing = activePlayers(r).length;
    const inGame = r.phase !== "lobby" && r.phase !== "results";
    let spectator = wantSpectator;
    if (!spectator && (playing >= r.settings.maxPlayers || (inGame && (!r.settings.allowLateJoin || isRisk(r) || r.settings.mode === "ranked" || r.settings.mode === "survival" || r.settings.mode === "tournament")))) {
      if (!r.settings.allowSpectators) return { error: inGame ? "This game is already in progress." : "This room is full." };
      spectator = true;
    }
    if (spectator && !r.settings.allowSpectators) return { error: "Spectators aren't allowed in this room." };
    p = addPlayer(r, pl, registered, spectator);
    systemChat(r, `${p.avatar} ${p.name} joined${spectator ? " as a spectator" : ""}.`);
  } else if (!p.connected) {
    systemChat(r, `${p.avatar} ${p.name} reconnected.`);
  }
  // Pick up profile changes (name/avatar) on every join.
  p.name = pl.displayName;
  p.avatar = pl.avatar;
  p.photo = pl.photoUrl;
  p.color = pl.color;
  p.connected = true;
  p.disconnectedAt = undefined;
  p.sockets.add(socketId);
  r.lastActive = Date.now();
  broadcastState(r);
  return { player: p };
}

export function sessionPayload(r: Room, playerId: string) {
  return {
    state: snapshot(r),
    chat: r.chat.slice(-40),
    round: r.live && (r.phase === "question" || r.phase === "reveal") ? roundPayload(r) : null,
    reveal: r.phase === "reveal" ? r.live?.reveal ?? null : null,
    resume: r.phase === "question" ? resumeFor(r, playerId) : null,
    you: playerId,
  };
}

export function leaveSocket(r: Room, playerId: string, socketId: string, explicit: boolean) {
  const p = r.players.get(playerId);
  if (!p) return;
  p.sockets.delete(socketId);
  if (p.sockets.size > 0 && !explicit) return;
  if (explicit && (r.phase === "lobby" || r.phase === "results" || p.spectator)) {
    r.players.delete(playerId);
    systemChat(r, `${p.avatar} ${p.name} left.`);
  } else {
    p.connected = false;
    p.disconnectedAt = Date.now();
    if (explicit) p.sockets.clear();
    systemChat(r, `${p.avatar} ${p.name} disconnected.`);
  }
  if (r.hostId === playerId) {
    // Give the host a moment to come back before handing over.
    setTimeout(() => {
      const h = r.players.get(r.hostId);
      if (rooms.has(r.code) && (!h || !h.connected)) transferHost(r);
    }, explicit ? 0 : 20_000).unref?.();
  }
  maybeEndQuestion(r);
  broadcastState(r);
}

function transferHost(r: Room, to?: string) {
  const next = to ? r.players.get(to) : [...r.players.values()].filter((p) => p.connected).sort((a, b) => Number(a.spectator) - Number(b.spectator) || a.joinedAt - b.joinedAt)[0];
  if (!next) return;
  r.hostId = next.id;
  systemChat(r, `${next.avatar} ${next.name} is now the host.`);
  broadcastState(r);
}

function sweepRooms() {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const anyone = [...r.players.values()].some((p) => p.connected);
    if ((!anyone && now - r.lastActive > 10 * 60_000) || now - r.createdAt > 12 * 3600_000) {
      clearTimeout(r.timer);
      rooms.delete(code);
      db.room.update({ where: { id: r.id }, data: { status: "FINISHED", closedAt: new Date() } }).catch(() => undefined);
    }
  }
}

/** Live counts for the admin dashboard. */
export function roomStats() {
  let players = 0;
  let playing = 0;
  const byGame = new Map<string, number>();
  for (const r of rooms.values()) {
    const n = [...r.players.values()].filter((p) => p.connected).length;
    players += n;
    if (r.phase !== "lobby" && r.phase !== "results") playing++;
    byGame.set(r.settings.gameSlug, (byGame.get(r.settings.gameSlug) ?? 0) + 1);
  }
  return {
    rooms: rooms.size,
    playing,
    players,
    list: [...rooms.values()].slice(0, 50).map((r) => ({ code: r.code, game: r.settings.gameSlug, mode: r.settings.mode, phase: r.phase, players: [...r.players.values()].filter((p) => p.connected).length, private: r.settings.isPrivate, createdAt: r.createdAt })),
  };
}

export function publicRooms() {
  return [...rooms.values()]
    .filter((r) => !r.settings.isPrivate && r.phase === "lobby" && activePlayers(r).length < r.settings.maxPlayers)
    .map((r) => ({ code: r.code, game: getGame(r.settings.gameSlug)?.name, icon: getGame(r.settings.gameSlug)?.icon, mode: r.settings.mode, players: activePlayers(r).length, max: r.settings.maxPlayers, host: r.players.get(r.hostId)?.name }))
    .slice(0, 30);
}

// ───────────────────────── host controls ─────────────────────────

function requireHost(r: Room, playerId: string) {
  if (r.hostId !== playerId) throw new Error("Only the host can do that.");
}

export function updateSettings(r: Room, playerId: string, patch: Partial<RoomSettings>) {
  requireHost(r, playerId);
  if (r.phase !== "lobby" && r.phase !== "results") throw new Error("Settings are locked during a game.");
  const merged = SettingsSchema.parse({ ...r.settings, ...patch });
  if (merged.gameSlug !== r.settings.gameSlug && patch.rounds === undefined) merged.rounds = getGame(merged.gameSlug)?.rounds ?? merged.rounds;
  if (merged.gameSlug !== r.settings.gameSlug && patch.modes === undefined) merged.modes = undefined;
  r.settings = sanitizeSettings(merged);
  if (r.settings.mode === "teams") {
    for (const p of r.players.values()) if (!p.spectator && (p.team === null || p.team >= r.settings.teamCount)) p.team = autoTeam(r);
  } else for (const p of r.players.values()) p.team = null;
  db.room.update({ where: { id: r.id }, data: { settings: r.settings as object } }).catch(() => undefined);
  broadcastState(r);
}

export function setTeam(r: Room, playerId: string, team: number) {
  if (r.settings.mode !== "teams" || (r.phase !== "lobby" && r.phase !== "results")) throw new Error("Teams can only be changed in the lobby.");
  const p = r.players.get(playerId);
  if (!p || p.spectator) throw new Error("Not a player.");
  if (team < 0 || team >= r.settings.teamCount) throw new Error("No such team.");
  p.team = team;
  broadcastState(r);
}

export function shuffleTeams(r: Room, playerId: string) {
  requireHost(r, playerId);
  const ps = shuffle(createRng(randomSeed()), activePlayers(r));
  ps.forEach((p, i) => (p.team = i % r.settings.teamCount));
  broadcastState(r);
}

export function setSpectator(r: Room, playerId: string, spectator: boolean) {
  if (r.phase !== "lobby" && r.phase !== "results") throw new Error("You can switch at the end of the game.");
  const p = r.players.get(playerId)!;
  if (!spectator && activePlayers(r).length >= r.settings.maxPlayers) throw new Error("The room is full.");
  p.spectator = spectator;
  p.team = !spectator && r.settings.mode === "teams" ? autoTeam(r) : null;
  broadcastState(r);
}

export function kick(r: Room, hostId: string, target: string, ban: boolean) {
  requireHost(r, hostId);
  if (target === hostId) throw new Error("You can't remove yourself.");
  const p = r.players.get(target);
  if (!p) return;
  r.players.delete(target);
  if (ban) r.banned.add(target);
  io?.to(`player:${target}`).emit("room:kicked", { code: r.code });
  for (const sid of p.sockets) io?.sockets.sockets.get(sid)?.leave(`room:${r.code}`);
  systemChat(r, `${p.name} was removed by the host.`);
  maybeEndQuestion(r);
  broadcastState(r);
}

export function makeHost(r: Room, hostId: string, target: string) {
  requireHost(r, hostId);
  if (!r.players.get(target)?.connected) throw new Error("That player isn't connected.");
  transferHost(r, target);
}

export function mute(r: Room, hostId: string, target: string, minutes: number) {
  requireHost(r, hostId);
  const p = r.players.get(target);
  if (p) p.mutedUntil = Date.now() + minutes * 60_000;
  systemChat(r, `${p?.name ?? "A player"} was muted for ${minutes} min.`);
}

// ───────────────────────── chat & reactions ─────────────────────────

function cleanText(t: string): string {
  return maskBlocked(t.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, "").trim().slice(0, 200));
}

export function chat(r: Room, playerId: string, text: string) {
  if (!r.settings.chat) throw new Error("Chat is turned off in this room.");
  const p = r.players.get(playerId);
  if (!p) throw new Error("Not in this room.");
  if (p.mutedUntil > Date.now()) throw new Error("You're muted for now.");
  const clean = cleanText(text);
  if (!clean) return;
  // Don't let anyone shout an exact answer while the question is live.
  if (r.phase === "question" && r.live && !p.spectator) {
    const acc = [r.live.round.secret.answerLabel, ...(r.live.round.secret.accept ?? [])].map((x) => x.toLowerCase());
    if (acc.some((a) => a.length > 2 && clean.toLowerCase().includes(a))) throw new Error("No spoilers while the round is live! 🤐");
  }
  const m: ChatMsg = { id: randomBytes(6).toString("base64url"), playerId, name: p.name, avatar: p.avatar, photo: p.photo, color: p.color, text: clean, at: Date.now() };
  r.chat.push(m);
  if (r.chat.length > 60) r.chat.shift();
  io?.to(`room:${r.code}`).emit("room:chat", m);
}

export function react(r: Room, playerId: string, emoji: string) {
  if (!(REACTIONS as readonly string[]).includes(emoji)) return;
  if (!r.players.has(playerId)) return;
  io?.to(`room:${r.code}`).emit("room:react", { playerId, emoji, id: randomBytes(4).toString("hex") });
}

// ───────────────────────── game flow ─────────────────────────

function currentGameSlug(r: Room): string {
  return r.settings.mode === "tournament" && r.stageGames.length ? r.stageGames[Math.min(r.stage, r.stageGames.length - 1)] : r.settings.gameSlug;
}

function setTimer(r: Room, ms: number, fn: () => void) {
  clearTimeout(r.timer);
  r.phaseEndsAt = Date.now() + ms;
  r.timer = setTimeout(() => {
    fn();
  }, ms);
}

export async function startGame(r: Room, playerId: string) {
  requireHost(r, playerId);
  if (r.phase !== "lobby" && r.phase !== "results") throw new Error("A game is already running.");
  const players = [...r.players.values()].filter((p) => !p.spectator && p.connected);
  if (!players.length) throw new Error("Nobody is playing yet.");
  if (r.settings.mode === "ranked" && players.length < 2) throw new Error("Ranked needs at least 2 players.");
  if (r.settings.mode === "teams") {
    const used = new Set(players.map((p) => p.team));
    if (used.size < 2) throw new Error("Put players on at least two different teams.");
  }
  const cfg = await gameConfig(r.settings.gameSlug);
  if (!cfg.enabled) throw new Error("This game is temporarily unavailable.");
  // Remove players who left during the lobby; reset everyone else.
  for (const p of [...r.players.values()]) {
    if (!p.connected && !p.spectator) {
      r.players.delete(p.id);
      continue;
    }
    Object.assign(p, { score: isRisk(r) ? r.settings.startingChips : 0, streak: 0, bestStreak: 0, correct: 0, rounds: 0, lives: r.settings.lives, eliminated: false, eliminatedAt: undefined, balanceBefore: undefined, qualities: [], maxRarity: 0, lastPoints: null });
  }
  if (r.settings.mode === "tournament") {
    const pool = multiplayerGames().map((g) => g.slug).filter((s) => s !== "quickfire" && s !== RISK_SLUG);
    const chosen = r.settings.tournamentGames.length >= 2 ? r.settings.tournamentGames : shuffle(createRng(randomSeed()), pool).slice(0, 3);
    r.stageGames = chosen;
    r.stage = 0;
  } else {
    r.stageGames = [];
    r.stage = 0;
  }
  const ids = activePlayers(r).map((p) => p.id);
  r.seed = randomSeed();
  r.rng = createRng(r.seed);
  r.history = await loadHistory(ids);
  r.memory = emptySessionMemory();
  r.final = undefined;
  if (r.settings.mode === "ranked") {
    const rows = await db.rating.findMany({ where: { playerId: { in: ids }, board: r.settings.gameSlug } });
    r.ratingsBefore = new Map(ids.map((id) => [id, rows.find((x) => x.playerId === id)?.rating ?? 1000]));
  }
  r.gmLeader = undefined;
  await beginStage(r);
  gameMaster(r, { type: "start", game: r.settings.mode === "tournament" ? "the Tournament" : getGame(r.settings.gameSlug)?.name ?? "the game", mode: r.settings.mode, players: activePlayers(r).map((p) => p.name), rounds: r.totalRounds });
  db.room.update({ where: { id: r.id }, data: { status: "PLAYING" } }).catch(() => undefined);
  await trackEvent("room_game_start", playerId, r.settings.gameSlug, { mode: r.settings.mode, players: ids.length });
}

async function beginStage(r: Room) {
  const slug = currentGameSlug(r);
  const ids = activePlayers(r).map((p) => p.id);
  r.skill = await getSkill(ids, slug);
  r.index = -1;
  r.totalRounds = r.settings.mode === "survival" ? 0 : r.settings.mode === "tournament" ? Math.min(r.settings.rounds, 8) : r.settings.rounds;
  r.pick = {
    modes: r.settings.mode === "tournament" ? undefined : r.settings.modes,
    history: r.history!,
    memory: r.memory!,
    rng: r.rng!,
    skill: r.skill,
    index: 0,
    total: r.totalRounds,
    timeLimitSec: r.settings.timeLimitSec ?? undefined,
  };
  const match = await db.match.create({ data: { roomId: r.id, mode: `room:${r.settings.mode}`, gameSlug: slug, seed: r.seed! } });
  r.matchId = match.id;
  r.phase = "countdown";
  setTimer(r, 3500, () => void nextQuestion(r).catch((e) => fail(r, e)));
  broadcastState(r);
}

function fail(r: Room, e: unknown) {
  console.error(`[room ${r.code}]`, e);
  systemChat(r, "Something went wrong loading the next round — ending the game.");
  void finishGame(r).catch(() => undefined);
}

async function nextQuestion(r: Room) {
  if (r.phase === "results" || r.phase === "lobby" || r.phase === "question" || r.busy) return;
  r.busy = true;
  clearTimeout(r.timer);
  try {
    await nextQuestionInner(r);
  } finally {
    r.busy = false;
  }
}

async function nextQuestionInner(r: Room) {
  const game = getGame(currentGameSlug(r))!;
  const active = activePlayers(r);
  const survivalOver =
    (r.settings.mode === "survival" && (active.length === 0 || (active.length <= 1 && [...r.players.values()].filter((p) => !p.spectator).length > 1))) ||
    (isRisk(r) && chipMatchDecided(chipPlayers(r)));
  if ((r.totalRounds > 0 && r.index + 1 >= r.totalRounds) || survivalOver || r.index >= 39 || active.length === 0) return endStage(r);
  const pick = r.pick!;
  pick.index = r.index + 1;
  pick.difficultyBoost = r.settings.mode === "survival" ? Math.min(2, pick.index * 0.12) : 0;
  pick.notice = undefined;
  const built = await pickRound(pick, game);
  if (!built) return endStage(r);
  r.notice = pick.notice;
  r.index++;
  const now = Date.now();
  let modifier: (typeof MODIFIERS)[number] | undefined;
  if (r.settings.mode === "chaos" && r.rng!() < 0.55) modifier = MODIFIERS[Math.floor(r.rng!() * MODIFIERS.length)];
  if (modifier?.id === "quick") built.round.pub.timeLimitSec = Math.max(6, Math.round(built.round.pub.timeLimitSec / 2));
  const pub: PublicRound = { ...built.round.pub, roundId: randomBytes(9).toString("base64url"), repeat: built.repeat };
  if (modifier?.id === "blind") pub.modeLabel = "🙈 Mystery round";
  const states = new Map<string, PlayerRoundState>();
  for (const p of active) states.set(p.id, newPlayerState(built.round, now));
  const deadline = now + pub.timeLimitSec * 1000 + 1000;
  r.live = { roundId: pub.roundId, round: built.round, pub, states, startedAt: now, deadline, modifier };
  r.phase = "question";
  setTimer(r, deadline - now, () => void endQuestion(r).catch((e) => fail(r, e)));
  io?.to(`room:${r.code}`).emit("room:round", roundPayload(r));
  broadcastState(r);
  const dbRound = await db.round.create({ data: { matchId: r.matchId!, index: r.index, gameSlug: built.round.gameSlug, contentKey: built.round.contentKey } }).catch(() => null);
  if (r.live?.roundId === pub.roundId) r.live.dbRoundId = dbRound?.id;
  await recordSeen(active.map((p) => ({ playerId: p.id, gameSlug: built.round.gameSlug, contentKey: built.round.contentKey, subjectKey: built.round.subjectKey, topic: built.round.topic, roomCode: r.code })));
  r.history!.contentLastSeen.set(built.round.contentKey, now);
  r.history!.subjectLastSeen.set(built.round.subjectKey, now);
}

function ctxFor(r: Room, p: RoomPlayer, scoring: ReturnType<typeof mergeScoring>, now = Date.now()) {
  return { now, streak: p.streak, playerId: p.id, scoring, services: { rarity: prismaRarityStore }, roomSize: activePlayers(r).length, balance: isRisk(r) ? p.score : undefined };
}

export async function act(r: Room, playerId: string, roundId: string, action: Action) {
  const l = r.live;
  if (r.phase !== "question" || !l || l.roundId !== roundId) return { error: "That round is over." };
  if (l.pausedAt) return { error: "The game is paused." };
  const p = r.players.get(playerId);
  const st = l.states.get(playerId);
  if (!p || !st || p.eliminated) return { error: "You're watching this round." };
  if (st.done) return { error: "Already answered." };
  if (action.type === "hint" && !r.settings.hints && l.round.handler !== "reveal" && l.round.handler !== "clues") return { error: "Hints are off in this room." };
  const now = Date.now();
  if (now > l.deadline) return { error: "Time's up!" };
  const cfg = await gameConfig(l.round.gameSlug);
  const scoring = mergeScoring(getGame(l.round.gameSlug)?.scoring, cfg.scoring);
  const res = await applyAction(l.round, st, action, ctxFor(r, p, scoring, now));
  if (res.error) return { error: res.error };
  if (st.done) {
    st.data.doneAt = now;
    // Points are known privately now; everyone learns answers at the reveal.
    broadcastState(r);
    maybeEndQuestion(r);
    return { feedback: stripAnswer(res.feedback), reveal: res.reveal, done: true, correct: st.correct, points: st.points };
  }
  return { feedback: res.feedback, reveal: res.reveal, done: false };
}

/** Feedback after finishing must not reveal anything other players could still use. */
function stripAnswer(f?: Record<string, unknown>) {
  if (!f) return f;
  const { canonical: _c, ...rest } = f as Record<string, unknown> & { canonical?: unknown };
  return rest;
}

function maybeEndQuestion(r: Room) {
  if (r.phase !== "question" || !r.live || r.live.pausedAt) return;
  const waiting = [...r.live.states.entries()].filter(([id, st]) => {
    const p = r.players.get(id);
    return p && p.connected && !p.eliminated && !st.done;
  });
  if (waiting.length === 0) {
    // Short beat so the last answer's animation can land.
    setTimer(r, 700, () => void endQuestion(r).catch((e) => fail(r, e)));
  }
}

async function endQuestion(r: Room) {
  const l = r.live;
  if (r.phase !== "question" || !l) return;
  r.phase = "reveal";
  clearTimeout(r.timer);
  const cfg = await gameConfig(l.round.gameSlug);
  const scoring = mergeScoring(getGame(l.round.gameSlug)?.scoring, cfg.scoring);
  const now = Date.now();
  const results: RoundResult[] = [];
  for (const [id, st] of l.states) {
    const p = r.players.get(id);
    if (p && !st.done) applyTimeout(l.round, st, ctxFor(r, p, scoring, now));
  }
  // Numeric rounds: the closest guess(es) win the round, computed once here on the server.
  const closest = l.round.handler === "number" && l.round.secret.numeric ? applyClosest(l.round.secret.numeric.value, l.states) : null;
  for (const [id, st] of l.states) {
    const p = r.players.get(id);
    if (!p) continue;
    const risk = isRisk(r);
    // Chip rounds are never multiplied by chaos modifiers: the stake is the whole story.
    if (!risk && l.modifier?.id === "double") st.points *= 2;
    if (!risk && l.modifier?.id === "jackpot") st.points = st.correct ? st.points * 3 : -50;
    if (st.breakdown) st.breakdown.total = st.points;
    const before = p.score;
    p.score = risk ? applyNet(p.score, st.points) : Math.max(0, p.score + st.points);
    if (risk && p.score === 0 && !p.eliminated) {
      p.eliminated = true;
      p.eliminatedAt = r.index;
      p.balanceBefore = before;
      systemChat(r, `💸 ${p.name} is out of chips and is now spectating.`);
    }
    p.lastPoints = st.points;
    p.rounds++;
    p.qualities.push(st.quality);
    if (l.round.handler === "rare") p.maxRarity = Math.max(p.maxRarity, st.breakdown?.rarity ?? 0);
    if (st.correct) {
      p.streak++;
      p.correct++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
    } else {
      p.streak = 0;
      if (r.settings.mode === "survival" && !risk) {
        p.lives--;
        if (p.lives <= 0) {
          p.eliminated = true;
          p.eliminatedAt = r.index;
          systemChat(r, `💀 ${p.name} is out!`);
        }
      }
    }
    const c = closest?.get(id);
    results.push({
      playerId: id,
      correct: st.correct,
      points: st.points,
      answer: st.answerLabel,
      breakdown: st.breakdown,
      ...(c ? { guess: c.guess, distance: c.distance, closest: c.closest, closestRank: c.rank } : {}),
      ...(risk ? { stake: (st.data.bet as number | null) ?? null, balance: p.score, eliminated: p.eliminated && p.eliminatedAt === r.index } : {}),
    });
    if (l.dbRoundId)
      db.submission.create({ data: { roundId: l.dbRoundId, playerId: id, answer: { label: st.answerLabel ?? null } as object, correct: st.correct, points: st.points, responseMs: Math.max(0, now - st.startedAt) } }).catch(() => undefined);
  }
  for (const p of r.players.values()) if (!l.states.has(p.id)) p.lastPoints = null;
  const answers = [...l.states.values()].map((st) => ({ answerKey: st.data.answerKey as string | undefined, label: st.answerLabel }));
  const reveal = await buildReveal(l.round, { rarity: prismaRarityStore }, answers);
  l.reveal = { ...reveal, extra: { ...(reveal.extra ?? {}), results } };
  const correctCount = results.filter((x) => x.correct).length;
  db.question.updateMany({ where: { contentKey: l.round.contentKey }, data: { playCount: { increment: results.length }, correctCount: { increment: correctCount }, lastPlayedAt: new Date() } }).catch(() => undefined);
  setTimer(r, r.settings.revealSec * 1000, () => void nextQuestion(r).catch((e) => fail(r, e)));
  io?.to(`room:${r.code}`).emit("room:reveal", { roundId: l.roundId, reveal: l.reveal });
  broadcastState(r);
  commentOnReveal(r, l, results);
}

function commentOnReveal(r: Room, l: LiveRound, results: { playerId: string; correct: boolean; points: number }[]) {
  const name = (id: string) => r.players.get(id)?.name ?? "?";
  const right = results.filter((x) => x.correct);
  const fastest = right
    .map((x) => ({ id: x.playerId, at: (l.states.get(x.playerId)?.data.doneAt as number | undefined) ?? Infinity }))
    .sort((a, b) => a.at - b.at)[0];
  const streaker = activePlayers(r).sort((a, b) => b.streak - a.streak)[0];
  const leader = activePlayers(r).sort((a, b) => b.score - a.score)[0];
  const top = [...results].sort((a, b) => b.points - a.points)[0];
  const solo = activePlayers(r).length < 2;
  gameMaster(r, {
    type: "reveal",
    answer: l.reveal?.answerLabel ?? "",
    round: r.index + 1,
    total: r.totalRounds,
    correct: right.map((x) => name(x.playerId)),
    wrong: results.filter((x) => !x.correct).map((x) => name(x.playerId)),
    fastest: fastest && right.length > 1 && Number.isFinite(fastest.at) ? name(fastest.id) : undefined,
    streak: streaker && streaker.streak >= 3 ? { name: streaker.name, n: streaker.streak } : undefined,
    leader: leader && !solo ? { name: leader.name, score: leader.score } : undefined,
    newLeader: !!leader && !solo && leader.score > 0 && r.gmLeader !== undefined && r.gmLeader !== leader.id,
    bigScore: top && top.points > 0 ? { name: name(top.playerId), points: top.points } : undefined,
  });
  if (leader) r.gmLeader = leader.id;
}

async function endStage(r: Room) {
  if (r.settings.mode === "tournament" && r.stage < r.stageGames.length - 1) {
    // Knock out the lowest scorer(s) while more than two remain.
    const active = activePlayers(r).sort((a, b) => a.score - b.score);
    if (active.length > 2) {
      const lowest = active[0].score;
      const out = active.filter((p) => p.score === lowest);
      if (out.length < active.length - 1)
        for (const p of out) {
          p.eliminated = true;
          p.eliminatedAt = r.stage * 100;
          systemChat(r, `🏁 ${p.name} is knocked out after stage ${r.stage + 1}.`);
        }
    }
    await db.match.update({ where: { id: r.matchId! }, data: { endedAt: new Date() } }).catch(() => undefined);
    r.phase = "stage";
    r.live = null;
    broadcastState(r);
    setTimer(r, 6000, () => {
      r.stage++;
      void beginStage(r).catch((e) => fail(r, e));
    });
    return;
  }
  await finishGame(r);
}

async function finishGame(r: Room) {
  clearTimeout(r.timer);
  r.phaseEndsAt = undefined;
  r.live = null;
  const players = [...r.players.values()].filter((p) => !p.spectator && p.rounds > 0);
  const standings: FinalResults["standings"] = [];
  const row = (p: RoomPlayer, rank: number) => ({ playerId: p.id, name: p.name, avatar: p.avatar, photo: p.photo, color: p.color, team: p.team, score: p.score, correct: p.correct, rank, eliminated: p.eliminated });
  if (isRisk(r)) {
    // Chip standings: players with chips by balance, then busts (later first, then pre-round balance).
    const byId = new Map(players.map((p) => [p.id, p]));
    for (const s of chipStandings(chipPlayers(r).filter((c) => byId.has(c.id)))) standings.push(row(byId.get(s.id)!, s.rank));
  } else {
    // Survivors rank above eliminated players; later eliminations above earlier ones; then by score.
    const ordered = players.sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0) || b.score - a.score);
    let rank = 0;
    ordered.forEach((p, i) => {
      const prev = ordered[i - 1];
      if (!prev || prev.score !== p.score || prev.eliminated !== p.eliminated || (prev.eliminatedAt ?? 0) !== (p.eliminatedAt ?? 0)) rank = i + 1;
      standings.push(row(p, rank));
    });
  }
  let teams: FinalResults["teams"];
  if (r.settings.mode === "teams") {
    const t = teamScores(r).filter((x) => x.members > 0).sort((a, b) => b.score - a.score);
    teams = t.map((x, i) => ({ team: x.team, name: x.name, score: x.score, rank: i > 0 && t[i - 1].score === x.score ? i : i + 1 }));
  }
  const winningTeam = teams?.[0]?.team;
  const tie = teams ? teams.length > 1 && teams[0].score === teams[1].score : standings.length > 1 && standings[1].rank === 1;
  const winnerName = tie ? "It's a tie!" : teams ? `Team ${teams[0].name}` : standings[0]?.name ?? "Nobody";
  r.final = { standings, teams, winnerName };
  r.phase = "results";
  broadcastState(r);
  if (standings.length > 1)
    gameMaster(r, { type: "final", winner: winnerName, tie, margin: (standings[0]?.score ?? 0) - (standings[1]?.score ?? 0), top: standings.slice(0, 3).map((x) => ({ name: x.name, score: x.score })) });
  db.room.update({ where: { id: r.id }, data: { status: "FINISHED" } }).catch(() => undefined);

  // Persist + progression (after the results are on screen).
  if (r.matchId) await db.match.update({ where: { id: r.matchId }, data: { endedAt: new Date() } }).catch(() => undefined);
  const slug = r.settings.mode === "tournament" ? "tournament" : r.settings.gameSlug;
  for (const s of standings) {
    const p = r.players.get(s.playerId)!;
    const won = !tie && (p.score > 0 || isRisk(r)) && (teams ? p.team === winningTeam : s.rank === 1 && standings.length > 1);
    if (r.matchId) db.score.create({ data: { matchId: r.matchId, playerId: p.id, points: p.score, rank: s.rank, correct: p.correct, rounds: p.rounds } }).catch(() => undefined);
    try {
      const prog = await applyGameResult({ playerId: p.id, gameSlug: slug, points: p.score, rounds: p.rounds, correct: p.correct, bestStreak: p.bestStreak, won, maxRarity: p.maxRarity, survivedRounds: r.settings.mode === "survival" ? p.rounds : 0, hosted: p.id === r.hostId, qualities: p.qualities });
      s.xp = prog.xpGained;
      s.levelUp = prog.leveledUp;
      s.achievements = prog.newAchievements.map((a) => ({ name: a.name, icon: a.icon }));
    } catch (e) {
      console.error("progress", e);
    }
  }
  if (r.settings.mode === "ranked" && r.ratingsBefore && standings.length >= 2) {
    for (const s of standings) {
      const opponents = standings.filter((o) => o.playerId !== s.playerId);
      const perf = opponents.reduce((acc, o) => acc + (s.score > o.score ? 1 : s.score === o.score ? 0.5 : 0), 0) / opponents.length;
      s.rating = await updateRating(s.playerId, r.settings.gameSlug, perf, opponents.map((o) => r.ratingsBefore!.get(o.playerId) ?? 1000));
      await updateRating(s.playerId, "global", perf, opponents.map((o) => r.ratingsBefore!.get(o.playerId) ?? 1000));
    }
  }
  broadcastState(r);
}

export function hostSkip(r: Room, playerId: string) {
  requireHost(r, playerId);
  if (r.phase === "question") void endQuestion(r).catch((e) => fail(r, e));
  else if (r.phase === "reveal") void nextQuestion(r).catch((e) => fail(r, e));
}

export function hostPause(r: Room, playerId: string, pause: boolean) {
  requireHost(r, playerId);
  const l = r.live;
  if (r.phase !== "question" || !l) throw new Error("You can only pause during a question.");
  if (pause && !l.pausedAt) {
    l.pausedAt = Date.now();
    clearTimeout(r.timer);
    r.phaseEndsAt = undefined;
    systemChat(r, "⏸️ The host paused the game.");
  } else if (!pause && l.pausedAt) {
    const paused = Date.now() - l.pausedAt;
    l.pausedAt = undefined;
    l.deadline += paused;
    for (const st of l.states.values()) {
      st.startedAt += paused;
      if (typeof st.data.readyAt === "number") st.data.readyAt += paused;
    }
    setTimer(r, l.deadline - Date.now(), () => void endQuestion(r).catch((e) => fail(r, e)));
    systemChat(r, "▶️ Back in action!");
  }
  io?.to(`room:${r.code}`).emit("room:round", roundPayload(r));
  broadcastState(r);
}

export async function hostEnd(r: Room, playerId: string) {
  requireHost(r, playerId);
  if (r.phase === "lobby") return;
  if (r.phase === "results") {
    r.phase = "lobby";
    r.final = undefined;
    for (const p of r.players.values()) Object.assign(p, { score: 0, streak: 0, correct: 0, lastPoints: null, eliminated: false });
    broadcastState(r);
    return;
  }
  clearTimeout(r.timer);
  if (r.phase === "question") await endQuestion(r);
  clearTimeout(r.timer);
  await finishGame(r);
}
