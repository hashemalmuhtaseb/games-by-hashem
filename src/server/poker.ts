import { randomBytes, randomInt } from "node:crypto";
import type { Server as IOServer } from "socket.io";
import { z } from "zod";
import type { Player } from "@prisma/client";
import { db } from "@/lib/db";
import { singleton } from "@/lib/globals";
import { botDecision } from "@/poker/bot";
import { act as tableAct, createTable, seatPlayer, standings, startHand, tableWinner, viewFor, type PokerAction, type Table } from "@/poker/table";
import { applyGameResult, trackEvent } from "./progress";

/**
 * Poker rooms (Texas Hold'em, virtual chips only — nothing can be bought, withdrawn or won).
 *
 * The server owns the deck and every hole card. Each player receives a personalised view over
 * their own `player:<id>` socket channel, built by `viewFor()`, which only ever contains that
 * player's own hole cards (plus everyone's cards that reach a showdown). Spectators get no hole
 * cards. Decks are shuffled with crypto.randomInt.
 */

export const PokerSettingsSchema = z.object({
  startingStack: z.number().int().min(200).max(100_000).default(1500),
  bigBlind: z.number().int().min(2).max(2000).default(20),
  levelHands: z.number().int().min(0).max(50).default(10),
  turnSec: z.number().int().min(10).max(90).default(30),
  maxSeats: z.number().int().min(2).max(8).default(8),
});
export type PokerSettings = z.infer<typeof PokerSettingsSchema>;

type Phase = "lobby" | "playing" | "finished";

interface Member {
  id: string;
  name: string;
  avatar: string;
  photo: string | null;
  color: string;
  connected: boolean;
  sockets: Set<string>;
}

export interface PokerRoom {
  code: string;
  hostId: string;
  solo: boolean;
  phase: Phase;
  settings: PokerSettings;
  table: Table;
  members: Map<string, Member>;
  deadline: number | null;
  timer?: NodeJS.Timeout;
  createdAt: number;
  lastActive: number;
  matchId?: string;
  final?: { id: string; name: string; stack: number; rank: number; bot: boolean }[];
  botSeq: number;
}

const rooms = singleton("pokerRooms", () => new Map<string, PokerRoom>());
let io: IOServer | null = null;

const BOT_NAMES = ["Ada", "Basil", "Cleo", "Dex", "Echo", "Fern", "Gus", "Hazel", "Iris", "Jules", "Kit", "Luna"];
const BOT_AVATARS = ["🤖", "🦾", "🧠", "👾", "🛰️", "🎛️", "🧩", "🎲"];
const BOT_COLORS = ["#64748b", "#0ea5e9", "#14b8a6", "#a855f7", "#f97316", "#84cc16", "#ec4899", "#eab308"];
const SHOWDOWN_PAUSE_MS = 5500;
const randInt = (n: number) => randomInt(n);

export function attachPokerIO(server: IOServer) {
  io = server;
  setInterval(sweep, 60_000).unref();
}

function sweep() {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const anyone = [...r.members.values()].some((m) => m.connected);
    if ((!anyone && now - r.lastActive > 10 * 60_000) || now - r.createdAt > 12 * 3600_000) {
      clearTimeout(r.timer);
      rooms.delete(code);
    }
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  for (;;) {
    const code = "P" + [...randomBytes(4)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    if (!rooms.has(code)) return code;
  }
}

export function getPokerRoom(code: string): PokerRoom | undefined {
  return rooms.get(code.toUpperCase());
}

function freshTable(s: PokerSettings): Table {
  return createTable({ maxSeats: s.maxSeats, bb: s.bigBlind, sb: Math.max(1, Math.floor(s.bigBlind / 2)), levelHands: s.levelHands });
}

// ───────────────────────── snapshots ─────────────────────────

function meta(r: PokerRoom) {
  return {
    code: r.code,
    hostId: r.hostId,
    solo: r.solo,
    phase: r.phase,
    settings: r.settings,
    deadline: r.deadline,
    serverNow: Date.now(),
    spectators: [...r.members.values()].filter((m) => !r.table.seats.some((s) => s?.id === m.id)).map((m) => ({ id: m.id, name: m.name })),
    final: r.final ?? null,
  };
}

export type PokerMeta = ReturnType<typeof meta>;

export function pokerState(r: PokerRoom, playerId: string | null) {
  return { meta: meta(r), view: viewFor(r.table, playerId), you: playerId };
}

function broadcast(r: PokerRoom) {
  r.lastActive = Date.now();
  for (const m of r.members.values()) io?.to(`player:${m.id}`).emit("poker:state", pokerState(r, m.id));
}

// ───────────────────────── membership ─────────────────────────

function addBotSeat(r: PokerRoom) {
  const i = r.botSeq++;
  seatPlayer(r.table, {
    id: `bot-${r.code}-${i}`,
    name: `${BOT_NAMES[i % BOT_NAMES.length]} (bot)`,
    avatar: BOT_AVATARS[i % BOT_AVATARS.length],
    photo: null,
    color: BOT_COLORS[i % BOT_COLORS.length],
    stack: r.settings.startingStack,
    bot: true,
  });
}

export async function createPokerRoom(host: Player, opts: { solo: boolean; bots: number; settings?: Partial<PokerSettings> }): Promise<PokerRoom> {
  const settings = PokerSettingsSchema.parse({ ...(opts.settings ?? {}) });
  const r: PokerRoom = {
    code: newCode(),
    hostId: host.id,
    solo: opts.solo,
    phase: "lobby",
    settings,
    table: freshTable(settings),
    members: new Map(),
    deadline: null,
    createdAt: Date.now(),
    lastActive: Date.now(),
    botSeq: 0,
  };
  rooms.set(r.code, r);
  r.members.set(host.id, { id: host.id, name: host.displayName, avatar: host.avatar, photo: host.photoUrl, color: host.color, connected: false, sockets: new Set() });
  seatPlayer(r.table, { id: host.id, name: host.displayName, avatar: host.avatar, photo: host.photoUrl, color: host.color, stack: settings.startingStack, bot: false });
  const bots = Math.max(0, Math.min(settings.maxSeats - 1, opts.bots));
  for (let i = 0; i < bots; i++) addBotSeat(r);
  await trackEvent("poker_created", host.id, "poker", { solo: opts.solo, bots });
  return r;
}

export function joinPoker(r: PokerRoom, pl: Player, socketId: string, spectate: boolean) {
  let m = r.members.get(pl.id);
  if (!m) {
    m = { id: pl.id, name: pl.displayName, avatar: pl.avatar, photo: pl.photoUrl, color: pl.color, connected: true, sockets: new Set() };
    r.members.set(pl.id, m);
  }
  Object.assign(m, { name: pl.displayName, avatar: pl.avatar, photo: pl.photoUrl, color: pl.color, connected: true });
  m.sockets.add(socketId);
  const seated = r.table.seats.find((s) => s?.id === pl.id);
  if (seated) {
    Object.assign(seated, { name: pl.displayName, avatar: pl.avatar, photo: pl.photoUrl, color: pl.color, connected: true });
  } else if (!spectate && r.phase === "lobby" && !r.solo && r.table.seats.some((s) => s === null)) {
    seatPlayer(r.table, { id: pl.id, name: pl.displayName, avatar: pl.avatar, photo: pl.photoUrl, color: pl.color, stack: r.settings.startingStack, bot: false });
  }
  broadcast(r);
  return pokerState(r, pl.id);
}

export function leavePoker(r: PokerRoom, playerId: string, socketId: string, explicit: boolean) {
  const m = r.members.get(playerId);
  if (!m) return;
  m.sockets.delete(socketId);
  if (m.sockets.size > 0 && !explicit) return;
  m.connected = false;
  const seat = r.table.seats.findIndex((s) => s?.id === playerId);
  if (seat >= 0) {
    if (r.phase === "lobby" && explicit && playerId !== r.hostId) r.table.seats[seat] = null;
    else r.table.seats[seat]!.connected = false;
  }
  if (explicit && seat < 0) r.members.delete(playerId);
  if (r.hostId === playerId && explicit) {
    const next = [...r.members.values()].find((x) => x.connected && x.id !== playerId);
    if (next) r.hostId = next.id;
  }
  broadcast(r);
}

function requireHost(r: PokerRoom, playerId: string) {
  if (r.hostId !== playerId) throw new Error("Only the host can do that.");
}

export function updatePokerSettings(r: PokerRoom, playerId: string, patch: Partial<PokerSettings>) {
  requireHost(r, playerId);
  if (r.phase === "playing") throw new Error("Settings are locked during a game.");
  r.settings = PokerSettingsSchema.parse({ ...r.settings, ...patch });
  resetTable(r);
  broadcast(r);
}

function resetTable(r: PokerRoom) {
  const old = r.table.seats.filter((s) => !!s);
  r.table = freshTable(r.settings);
  for (const s of old.slice(0, r.settings.maxSeats)) seatPlayer(r.table, { id: s.id, name: s.name, avatar: s.avatar, photo: s.photo, color: s.color, stack: r.settings.startingStack, bot: s.bot, connected: s.connected });
}

export function addBot(r: PokerRoom, playerId: string) {
  requireHost(r, playerId);
  if (r.phase === "playing") throw new Error("Wait for this game to finish.");
  if (!r.table.seats.some((s) => s === null)) throw new Error("The table is full.");
  addBotSeat(r);
  broadcast(r);
}

export function removeBot(r: PokerRoom, playerId: string) {
  requireHost(r, playerId);
  if (r.phase === "playing") throw new Error("Wait for this game to finish.");
  const i = r.table.seats.map((s, j) => (s?.bot ? j : -1)).filter((j) => j >= 0).pop();
  if (i === undefined) throw new Error("No bots to remove.");
  r.table.seats[i] = null;
  broadcast(r);
}

export function takeSeat(r: PokerRoom, playerId: string) {
  if (r.phase === "playing") throw new Error("You can join at the next game.");
  const m = r.members.get(playerId);
  if (!m) throw new Error("Join the room first.");
  if (r.table.seats.some((s) => s?.id === playerId)) return;
  seatPlayer(r.table, { id: m.id, name: m.name, avatar: m.avatar, photo: m.photo, color: m.color, stack: r.settings.startingStack, bot: false });
  broadcast(r);
}

export function standUp(r: PokerRoom, playerId: string) {
  if (r.phase === "playing") throw new Error("You can leave the table between games.");
  const i = r.table.seats.findIndex((s) => s?.id === playerId);
  if (i >= 0) r.table.seats[i] = null;
  broadcast(r);
}

// ───────────────────────── game flow ─────────────────────────

export async function startPoker(r: PokerRoom, playerId: string) {
  requireHost(r, playerId);
  if (r.phase === "playing") throw new Error("A game is already running.");
  resetTable(r);
  // Drop seats of people who have left.
  r.table.seats = r.table.seats.map((s) => (s && !s.bot && !r.members.get(s.id)?.connected ? null : s));
  if (r.table.seats.filter(Boolean).length < 2) throw new Error("You need at least two players. Add a bot or invite a friend.");
  r.phase = "playing";
  r.final = undefined;
  const match = await db.match.create({ data: { mode: r.solo ? "poker:solo" : "poker:room", gameSlug: "poker", seed: randomBytes(8).toString("hex") } }).catch(() => null);
  r.matchId = match?.id;
  nextHand(r);
}

function nextHand(r: PokerRoom) {
  clearTimeout(r.timer);
  if (r.phase !== "playing") return;
  if (tableWinner(r.table)) return void finishGame(r);
  // Humans-only check: a solo table whose human busted ends immediately.
  const humans = r.table.seats.filter((s) => s && !s.bot && !s.out);
  if (r.solo && humans.length === 0) return void finishGame(r);
  startHand(r.table, randInt);
  afterChange(r);
}

function afterChange(r: PokerRoom) {
  clearTimeout(r.timer);
  const h = r.table.hand!;
  if (h.street === "showdown") {
    r.deadline = null;
    broadcast(r);
    r.timer = setTimeout(() => nextHand(r), SHOWDOWN_PAUSE_MS);
    return;
  }
  const seat = r.table.seats[h.toAct!]!;
  if (seat.bot) {
    r.deadline = null;
    broadcast(r);
    r.timer = setTimeout(() => botMove(r), 650 + randomInt(900));
    return;
  }
  // Disconnected players get a short clock so the table never stalls.
  const sec = seat.connected ? r.settings.turnSec : Math.min(8, r.settings.turnSec);
  r.deadline = Date.now() + sec * 1000;
  broadcast(r);
  r.timer = setTimeout(() => timeoutMove(r), sec * 1000 + 300);
}

function botMove(r: PokerRoom) {
  const h = r.table.hand;
  if (!h || h.street === "showdown" || h.toAct === null) return;
  const decision = botDecision(r.table, h.toAct, Math.random, 160);
  const res = tableAct(r.table, h.toAct, decision, randInt);
  if (res.error) tableAct(r.table, h.toAct, { type: "fold" }, randInt);
  afterChange(r);
}

function timeoutMove(r: PokerRoom) {
  const h = r.table.hand;
  if (!h || h.street === "showdown" || h.toAct === null) return;
  // Out of time: check when free, otherwise fold.
  const res = tableAct(r.table, h.toAct, { type: "check" }, randInt);
  if (res.error) tableAct(r.table, h.toAct, { type: "fold" }, randInt);
  afterChange(r);
}

export function pokerAct(r: PokerRoom, playerId: string, a: PokerAction) {
  if (r.phase !== "playing") throw new Error("The game hasn't started.");
  const h = r.table.hand;
  if (!h) throw new Error("No hand in progress.");
  const seat = r.table.seats.findIndex((s) => s?.id === playerId);
  if (seat < 0) throw new Error("You're watching this game.");
  const res = tableAct(r.table, seat, a, randInt);
  if (res.error) throw new Error(res.error);
  afterChange(r);
}

async function finishGame(r: PokerRoom) {
  clearTimeout(r.timer);
  r.phase = "finished";
  r.deadline = null;
  const st = standings(r.table);
  r.final = st.map((s) => ({ ...s, bot: !!r.table.seats.find((x) => x?.id === s.id)?.bot }));
  broadcast(r);
  if (r.matchId) await db.match.update({ where: { id: r.matchId }, data: { endedAt: new Date() } }).catch(() => undefined);
  for (const s of r.final) {
    if (s.bot) continue;
    const won = s.rank === 1 && r.final.filter((x) => x.rank === 1).length === 1;
    if (r.matchId) await db.score.create({ data: { matchId: r.matchId, playerId: s.id, points: s.stack, rank: s.rank, correct: won ? 1 : 0, rounds: r.table.handsPlayed } }).catch(() => undefined);
    await applyGameResult({ playerId: s.id, gameSlug: "poker", points: Math.min(s.stack, 10_000), rounds: r.table.handsPlayed, correct: 0, bestStreak: 0, won, qualities: [] }).catch((e) => console.error("poker progress", e));
  }
}

export function pokerStats() {
  return { tables: rooms.size, playing: [...rooms.values()].filter((r) => r.phase === "playing").length };
}
