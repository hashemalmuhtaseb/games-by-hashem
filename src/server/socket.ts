import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { identify, parseCookies } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import * as R from "./rooms";
import * as P from "./poker";

/**
 * Socket.IO wiring. Every event is: rate limited per player → zod validated → applied by the
 * authoritative room service. Errors come back through the ack as a friendly message.
 */

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), value: z.union([z.string().max(80), z.number(), z.array(z.string().max(40)).max(12), z.record(z.string().max(40), z.number().int().min(0).max(1))]) }),
  z.object({ type: z.literal("hint") }),
  z.object({ type: z.literal("give-up") }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("bet"), value: z.number().max(10_000_000) }),
]);

const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/);

type Ack = (res: unknown) => void;

export function registerSocketHandlers(io: Server) {
  R.attachIO(io);
  P.attachPokerIO(io);

  io.use(async (socket, nextFn) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const id = await identify(cookies, false);
      if (!id) return nextFn(new Error("no-identity"));
      socket.data.playerId = id.player.id;
      socket.data.registered = !!id.user;
      nextFn();
    } catch {
      nextFn(new Error("auth-failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const playerId: string = socket.data.playerId;
    socket.join(`player:${playerId}`);
    let code: string | null = null;
    let pokerCode: string | null = null;

    const on = <T>(event: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, limit: [number, number], fn: (data: T) => unknown | Promise<unknown>) => {
      socket.on(event, async (raw: unknown, ack?: Ack) => {
        const reply = typeof ack === "function" ? ack : () => undefined;
        if (!rateLimit(`ws:${playerId}:${event}`, limit[0], limit[1])) return reply({ error: "Slow down a little!" });
        const parsed = schema.safeParse(raw ?? {});
        if (!parsed.success) return reply({ error: "Invalid request." });
        try {
          const out = await fn(parsed.data);
          reply(out ?? { ok: true });
        } catch (e) {
          const msg = e instanceof Error && e.message.length < 140 && !/prisma|sql/i.test(e.message) ? e.message : "Something went wrong.";
          if (!(e instanceof Error) || /prisma|sql/i.test(e.message)) console.error(`[ws:${event}]`, e);
          reply({ error: msg });
        }
      });
    };

    const room = () => {
      const r = code ? R.getRoom(code) : undefined;
      if (!r || !r.players.has(playerId)) throw new Error("You're not in a room.");
      return r;
    };

    const freshPlayer = async () => {
      const id = await identify(parseCookies(socket.handshake.headers.cookie), false);
      if (!id) throw new Error("Session expired — refresh the page.");
      return id;
    };

    on("room:create", z.object({ settings: R.SettingsSchema.partial().optional() }), [5, 0.05], async ({ settings }) => {
      const id = await freshPlayer();
      const r = await R.createRoom(id.player, !!id.user, settings);
      return { code: r.code };
    });

    on("room:join", z.object({ code: Code, spectator: z.boolean().optional() }), [20, 0.5], async (d) => {
      const r = R.getRoom(d.code);
      if (!r) throw new Error("No room with that code — check it and try again.");
      const id = await freshPlayer();
      if (code && code !== r.code) {
        const old = R.getRoom(code);
        if (old) R.leaveSocket(old, playerId, socket.id, false);
        socket.leave(`room:${code}`);
      }
      const res = R.joinRoom(r, id.player, !!id.user, !!d.spectator, socket.id);
      if (res.error) throw new Error(res.error);
      code = r.code;
      socket.join(`room:${r.code}`);
      return R.sessionPayload(r, playerId);
    });

    on("room:leave", z.object({}), [10, 0.5], () => {
      const r = room();
      R.leaveSocket(r, playerId, socket.id, true);
      socket.leave(`room:${r.code}`);
      code = null;
    });

    on("rooms:list", z.object({}), [20, 1], () => ({ rooms: R.publicRooms() }));
    on("room:settings", R.SettingsSchema.partial(), [30, 2], (patch) => R.updateSettings(room(), playerId, patch));
    on("room:team", z.object({ team: z.number().int().min(0).max(3) }), [20, 2], ({ team }) => R.setTeam(room(), playerId, team));
    on("room:shuffle-teams", z.object({}), [10, 1], () => R.shuffleTeams(room(), playerId));
    on("room:spectate", z.object({ spectator: z.boolean() }), [10, 1], ({ spectator }) => R.setSpectator(room(), playerId, spectator));
    on("room:start", z.object({}), [5, 0.2], () => R.startGame(room(), playerId));
    on("room:act", z.object({ roundId: z.string().max(40), action: ActionSchema }), [40, 4], ({ roundId, action }) => R.act(room(), playerId, roundId, action));
    on("room:chat", z.object({ text: z.string().min(1).max(300) }), [8, 0.7], ({ text }) => R.chat(room(), playerId, text));
    on("room:react", z.object({ emoji: z.string().max(8) }), [12, 2], ({ emoji }) => R.react(room(), playerId, emoji));
    on("room:kick", z.object({ playerId: z.string().max(40), ban: z.boolean().optional() }), [10, 1], (d) => R.kick(room(), playerId, d.playerId, !!d.ban));
    on("room:host", z.object({ playerId: z.string().max(40) }), [10, 1], (d) => R.makeHost(room(), playerId, d.playerId));
    on("room:mute", z.object({ playerId: z.string().max(40), minutes: z.number().int().min(1).max(60) }), [10, 1], (d) => R.mute(room(), playerId, d.playerId, d.minutes));
    on("room:skip", z.object({}), [10, 1], () => R.hostSkip(room(), playerId));
    on("room:pause", z.object({ pause: z.boolean() }), [10, 1], ({ pause }) => R.hostPause(room(), playerId, pause));
    on("room:end", z.object({}), [10, 1], () => R.hostEnd(room(), playerId));

    // ───────── poker ─────────
    const PokerCode = z.string().trim().toUpperCase().regex(/^P[A-Z0-9]{4}$/);
    const table = () => {
      const t = pokerCode ? P.getPokerRoom(pokerCode) : undefined;
      if (!t || !t.members.has(playerId)) throw new Error("You're not at a poker table.");
      return t;
    };
    on("poker:create", z.object({ solo: z.boolean(), bots: z.number().int().min(0).max(7), settings: P.PokerSettingsSchema.partial().optional() }), [5, 0.05], async (d) => {
      const id = await freshPlayer();
      const t = await P.createPokerRoom(id.player, { solo: d.solo, bots: d.solo ? Math.max(1, d.bots) : d.bots, settings: d.settings });
      return { code: t.code };
    });
    on("poker:join", z.object({ code: PokerCode, spectate: z.boolean().optional() }), [20, 0.5], async (d) => {
      const t = P.getPokerRoom(d.code);
      if (!t) throw new Error("No poker table with that code.");
      if (t.solo && t.hostId !== playerId) throw new Error("That's a private solo table.");
      const id = await freshPlayer();
      if (pokerCode && pokerCode !== t.code) {
        const old = P.getPokerRoom(pokerCode);
        if (old) P.leavePoker(old, playerId, socket.id, false);
      }
      pokerCode = t.code;
      return P.joinPoker(t, id.player, socket.id, !!d.spectate);
    });
    on("poker:leave", z.object({}), [10, 0.5], () => {
      const t = table();
      P.leavePoker(t, playerId, socket.id, true);
      pokerCode = null;
    });
    on("poker:settings", P.PokerSettingsSchema.partial(), [20, 1], (patch) => P.updatePokerSettings(table(), playerId, patch));
    on("poker:add-bot", z.object({}), [20, 1], () => P.addBot(table(), playerId));
    on("poker:remove-bot", z.object({}), [20, 1], () => P.removeBot(table(), playerId));
    on("poker:sit", z.object({}), [10, 0.5], () => P.takeSeat(table(), playerId));
    on("poker:stand", z.object({}), [10, 0.5], () => P.standUp(table(), playerId));
    on("poker:start", z.object({}), [5, 0.2], () => P.startPoker(table(), playerId));
    on(
      "poker:act",
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("fold") }),
        z.object({ type: z.literal("check") }),
        z.object({ type: z.literal("call") }),
        z.object({ type: z.literal("allin") }),
        z.object({ type: z.literal("raise"), to: z.number().int().min(1).max(100_000_000) }),
      ]),
      [30, 3],
      (a) => P.pokerAct(table(), playerId, a),
    );

    socket.on("disconnect", () => {
      if (pokerCode) {
        const t = P.getPokerRoom(pokerCode);
        if (t) P.leavePoker(t, playerId, socket.id, false);
      }
      if (!code) return;
      const r = R.getRoom(code);
      if (r) R.leaveSocket(r, playerId, socket.id, false);
    });
  });
}
