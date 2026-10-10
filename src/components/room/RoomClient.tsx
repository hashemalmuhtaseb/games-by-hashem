"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/engine/types";
import { emit, getSocket } from "@/client/socket";
import { play } from "@/client/sound";
import { burst } from "@/client/confetti";
import { useMe } from "@/client/me";
import { Avatar } from "@/components/Avatar";
import { RoundPlayer, TimerBar, type ActResponse, type Resume } from "@/components/play/Round";
import { RevealPanel } from "@/components/play/Reveal";
import { Lobby } from "./Lobby";
import { Chat } from "./Chat";
import { Scoreboard } from "./Scoreboard";
import type { ChatMsg, RoomReveal, RoomSnapshot, RoundMsg } from "./types";

interface JoinPayload {
  state: RoomSnapshot;
  chat: ChatMsg[];
  round: RoundMsg | null;
  reveal: RoomReveal | null;
  resume: Resume | null;
  you: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  name: string;
}

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { refresh } = useMe();
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [me, setMe] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [round, setRound] = useState<RoundMsg | null>(null);
  const [offset, setOffset] = useState(0);
  const [reveal, setReveal] = useState<RoomReveal | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [mine, setMine] = useState<{ correct?: boolean; points?: number; done: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastPhase = useRef<string>("");
  const roundIdRef = useRef<string | null>(null);
  const stateRef = useRef<RoomSnapshot | null>(null);

  const join = useCallback(async () => {
    const r = await emit<JoinPayload>("room:join", { code });
    if (r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    setMe(r.you);
    setState(r.state);
    stateRef.current = r.state;
    setChat(r.chat);
    setOffset(r.state.serverNow - Date.now());
    if (r.round) {
      roundIdRef.current = r.round.round.roundId;
      setRound(r.round);
      setReveal(r.reveal);
      setResume(r.resume);
      setMine(r.resume?.done ? { done: true, correct: r.resume.correct, points: r.resume.points } : null);
    }
  }, [code]);

  useEffect(() => {
    const s = getSocket();
    const onConnect = () => {
      setConnected(true);
      void join();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (st: RoomSnapshot) => {
      setState(st);
      stateRef.current = st;
      setOffset(st.serverNow - Date.now());
      if (st.phase !== lastPhase.current) {
        if (st.phase === "countdown") play("start");
        if (st.phase === "results") {
          const top = st.final?.standings[0];
          play("win");
          if (top) burst("big");
          void refresh();
        }
        if (st.phase === "lobby") {
          setRound(null);
          setReveal(null);
        }
        lastPhase.current = st.phase;
      }
    };
    const onRound = (r: RoundMsg) => {
      if (roundIdRef.current !== r.round.roundId) {
        setReveal(null);
        setResume(null);
        setMine(null);
      }
      roundIdRef.current = r.round.roundId;
      setRound(r);
      setOffset(r.serverNow - Date.now());
    };
    const onReveal = (d: { roundId: string; reveal: RoomReveal }) => {
      if (d.roundId !== roundIdRef.current) return;
      setReveal(d.reveal);
      play("reveal");
    };
    const onChat = (m: ChatMsg) => {
      setChat((c) => [...c.slice(-80), m]);
      if (!m.system) setUnread((u) => u + 1);
    };
    const onReact = (r: { playerId: string; emoji: string; id: string }) => {
      const p = stateRef.current?.players.find((x) => x.id === r.playerId);
      const f = { id: r.id, emoji: r.emoji, x: 10 + Math.random() * 80, name: p?.name ?? "" };
      setReactions((x) => [...x.slice(-20), f]);
      setTimeout(() => setReactions((x) => x.filter((y) => y.id !== f.id)), 2600);
    };
    const onKicked = () => {
      setError("You were removed from this room by the host.");
      setState(null);
    };
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("room:state", onState);
    s.on("room:round", onRound);
    s.on("room:reveal", onReveal);
    s.on("room:chat", onChat);
    s.on("room:react", onReact);
    s.on("room:kicked", onKicked);
    if (s.connected) void join();
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("room:state", onState);
      s.off("room:round", onRound);
      s.off("room:reveal", onReveal);
      s.off("room:chat", onChat);
      s.off("room:react", onReact);
      s.off("room:kicked", onKicked);
    };
  }, [join, refresh]);

  // My result for the revealed round (sound + confetti)
  useEffect(() => {
    if (!reveal || !me) return;
    const r = reveal.extra?.results?.find((x) => x.playerId === me);
    if (r) {
      setMine({ done: true, correct: r.correct, points: r.points });
      play(r.correct ? "correct" : "wrong");
    }
  }, [reveal, me]);

  const act = useCallback(
    async (a: Action): Promise<ActResponse | null> => {
      if (!round) return null;
      const r = await emit<ActResponse>("room:act", { roundId: round.round.roundId, action: a });
      if (r.done) {
        setMine({ done: true, correct: r.correct, points: r.points });
        play(r.correct ? "correct" : r.points && r.points > 0 ? "pop" : "wrong");
      }
      return r;
    },
    [round],
  );

  const leave = async () => {
    await emit("room:leave");
    router.push("/party");
  };

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="text-5xl">🚪</div>
          <p className="mt-4 text-lg text-white">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/party" className="btn-ghost">
              Find another room
            </Link>
            <button className="btn-primary" onClick={() => void join()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );

  if (!state)
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-brand-400" />
          Joining room {code}…
        </div>
      </div>
    );

  const isHost = state.hostId === me;
  const myPlayer = state.players.find((p) => p.id === me);
  const spectating = !myPlayer || myPlayer.spectator || myPlayer.eliminated;
  const inGame = state.phase === "question" || state.phase === "reveal" || state.phase === "countdown" || state.phase === "stage";

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-6">
      <header className="flex items-center gap-3 py-3">
        <button onClick={leave} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-white" aria-label="Leave room">
          ←
        </button>
        <span className="text-2xl">{state.game?.icon}</span>
        <div className="flex-1 leading-tight">
          <div className="display font-bold text-white">{state.game?.name}</div>
          <div className="text-xs text-ink-400">
            Room <b className="font-mono tracking-wider text-ink-300">{state.code}</b> · <span className="capitalize">{state.settings.mode}</span>
            {inGame && state.index >= 0 && ` · round ${state.index + 1}${state.totalRounds ? `/${state.totalRounds}` : ""}`}
            {state.stageGames.length > 0 && ` · stage ${state.stage + 1}/${state.stageGames.length}`}
          </div>
        </div>
        {!connected && <span className="chip border-warn-400/40 text-warn-400">Reconnecting…</span>}
        {myPlayer && <Avatar avatar={myPlayer.avatar} photo={myPlayer.photo} color={myPlayer.color} size={34} />}
      </header>

      {/* floating reactions */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div key={r.id} initial={{ y: "100vh", opacity: 1 }} animate={{ y: "35vh", opacity: 0 }} transition={{ duration: 2.5, ease: "easeOut" }} className="absolute flex flex-col items-center" style={{ left: `${r.x}%` }}>
              <span className="text-5xl">{r.emoji}</span>
              <span className="text-xs text-ink-300">{r.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {state.phase === "lobby" && (
        <div className="grid flex-1 gap-6 xl:grid-cols-[1fr_300px]">
          <Lobby state={state} me={me} />
          <aside className="card hidden h-[640px] p-4 xl:block">
            <Chat messages={chat} enabled={state.settings.chat} me={me} />
          </aside>
        </div>
      )}

      {inGame && (
        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_300px]">
          <section className="flex min-w-0 flex-col gap-4">
            {state.phase === "countdown" && <Countdown endsAt={state.phaseEndsAt} offset={offset} title={state.stageGames.length ? `Stage ${state.stage + 1}: ${state.stageGames[state.stage]?.name}` : "Get ready!"} />}
            {state.phase === "stage" && <StageBreak state={state} />}
            {(state.phase === "question" || state.phase === "reveal") && round && (
              <>
                {state.phase === "question" ? (
                  <TimerBar deadline={round.deadline} offset={offset} total={round.round.timeLimitSec} paused={state.paused} />
                ) : (
                  <NextBar endsAt={state.phaseEndsAt} offset={offset} />
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="chip">{round.round.modeLabel}</span>
                  <span className="chip">
                    {"★".repeat(round.round.difficulty)}
                    <span className="opacity-30">{"★".repeat(5 - round.round.difficulty)}</span>
                  </span>
                  {round.modifier && <span className="chip border-hot-500/50 bg-hot-500/15 text-hot-500">{round.modifier.icon} {round.modifier.label}</span>}
                  {spectating && <span className="chip">👀 Spectating</span>}
                  {state.paused && <span className="chip border-warn-400/40 text-warn-400">⏸ Paused</span>}
                </div>
                {round.notice && <div className="text-center text-sm text-warn-400">{round.notice}</div>}
                <AnimatePresence mode="wait">
                  <motion.div key={round.round.roundId} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col items-center gap-5">
                    <RoundPlayer round={round.round} act={act} locked={spectating || !!mine?.done || state.paused} reveal={reveal} resume={resume} balance={myPlayer?.chips ?? undefined} />
                    {mine?.done && !reveal && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-ink-300">
                        ✓ Locked in{mine.points !== undefined ? ` — ${mine.points > 0 ? "+" : ""}${mine.points} pts` : ""}. Waiting for the others…
                      </motion.div>
                    )}
                    {reveal && (
                      <>
                        <RevealPanel reveal={reveal} points={spectating ? undefined : mine?.points} correct={mine?.correct} />
                        <AnswersList reveal={reveal} state={state} />
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
            {isHost && (
              <div className="mt-auto flex flex-wrap justify-center gap-2 pt-4">
                {state.phase === "question" && (
                  <button className="btn-ghost text-sm" onClick={() => void emit("room:pause", { pause: !state.paused })}>
                    {state.paused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                )}
                {(state.phase === "question" || state.phase === "reveal") && (
                  <button className="btn-ghost text-sm" onClick={() => void emit("room:skip")}>
                    {state.phase === "question" ? "⏭ Reveal now" : "⏭ Next round"}
                  </button>
                )}
                <button className="btn-danger text-sm" onClick={() => confirm("End the game for everyone?") && void emit("room:end")}>
                  End game
                </button>
              </div>
            )}
          </section>
          <aside className="flex flex-col gap-4">
            <div className="card p-4">
              <Scoreboard state={state} me={me} showAnswered={state.phase === "question"} />
            </div>
            <div className="card hidden h-80 p-4 lg:block">
              <Chat messages={chat} enabled={state.settings.chat} me={me} />
            </div>
          </aside>
        </div>
      )}

      {state.phase === "results" && state.final && <Results state={state} me={me} isHost={isHost} />}

      {/* mobile chat */}
      <button
        className="fixed right-4 bottom-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-2xl shadow-xl shadow-brand-500/30 lg:hidden"
        onClick={() => {
          setChatOpen((o) => !o);
          setUnread(0);
        }}
        aria-label="Chat"
      >
        💬
        {unread > 0 && !chatOpen && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-hot-500 px-1 text-xs font-bold">{unread}</span>}
      </button>
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} className="card fixed inset-x-2 bottom-20 z-40 h-96 p-4 lg:hidden">
            <Chat messages={chat} enabled={state.settings.chat} me={me} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useCountdown(endsAt: number | null | undefined, offset: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setLeft(Math.max(0, (endsAt - (Date.now() + offset)) / 1000)), 100);
    return () => clearInterval(t);
  }, [endsAt, offset]);
  return left;
}

function Countdown({ endsAt, offset, title }: { endsAt: number | null; offset: number; title: string }) {
  const left = useCountdown(endsAt, offset);
  const n = Math.ceil(left);
  return (
    <div className="grid flex-1 place-items-center py-20">
      <div className="text-center">
        <div className="display text-2xl font-bold text-ink-300">{title}</div>
        <AnimatePresence mode="popLayout">
          <motion.div key={n} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="display bg-gradient-to-br from-brand-400 to-hot-500 bg-clip-text text-[10rem] leading-none font-black text-transparent">
            {n > 0 ? n : "GO"}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NextBar({ endsAt, offset }: { endsAt: number | null; offset: number }) {
  const left = useCountdown(endsAt, offset);
  return <div className="text-center text-sm text-ink-400">Next round in {Math.ceil(left)}s</div>;
}

function StageBreak({ state }: { state: RoomSnapshot }) {
  const next = state.stageGames[state.stage + 1];
  const out = state.players.filter((p) => p.eliminated);
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="label">Stage {state.stage + 1} complete</div>
      {out.length > 0 && <div className="mt-3 text-lg text-bad-400">Knocked out: {out.map((p) => p.name).join(", ")}</div>}
      {next && (
        <div className="mt-6">
          <div className="label">Next up</div>
          <div className="display mt-1 text-3xl font-black text-white">
            {next.icon} {next.name}
          </div>
        </div>
      )}
    </div>
  );
}

function AnswersList({ reveal, state }: { reveal: RoomReveal; state: RoomSnapshot }) {
  const results = reveal.extra?.results ?? [];
  if (!results.length) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const numeric = results.some((r) => r.distance !== undefined);
  const unit = (reveal.extra as { unit?: string } | undefined)?.unit;
  const fmt = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 6 });
  const sorted = numeric
    ? results.slice().sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.points - a.points)
    : results.slice().sort((a, b) => b.points - a.points);
  return (
    <div className="grid w-full max-w-2xl gap-1.5 sm:grid-cols-2">
      {numeric && <div className="text-center text-xs text-ink-400 sm:col-span-2">Closest guess wins the round · distance = |guess − answer| · equal distances tie</div>}
      {sorted.map((r) => {
          const p = byId.get(r.playerId);
          if (!p) return null;
          return (
            <div key={r.playerId} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${r.closest ? "bg-amber-400/15 ring-1 ring-amber-300/60" : r.correct ? "bg-good-500/10" : "bg-white/[0.03]"}`}>
              <Avatar avatar={p.avatar} photo={p.photo} color={p.color} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">
                  {r.closest && <span title="Closest guess">🎯 </span>}
                  {p.name}
                </span>
                {numeric ? (
                  <span className="block truncate text-xs text-ink-400">
                    {r.guess === null || r.guess === undefined ? "No guess" : `Guessed ${fmt(r.guess)}${unit ? ` ${unit}` : ""} · off by ${fmt(r.distance ?? 0)}`}
                  </span>
                ) : (
                  <span className="block truncate text-xs text-ink-400">{r.answer ?? "—"}</span>
                )}
              </span>
              <span className={`font-bold tabular-nums ${r.correct ? "text-good-400" : r.points < 0 ? "text-bad-400" : "text-ink-400"}`}>
                {r.points > 0 ? "+" : ""}
                {r.points}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function Results({ state, me, isHost }: { state: RoomSnapshot; me: string; isHost: boolean }) {
  const f = state.final!;
  const podium = f.standings.slice(0, 3);
  const mine = f.standings.find((s) => s.playerId === me);
  const order = [1, 0, 2].filter((i) => podium[i]);
  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <div className="text-center">
        <div className="label">Winner</div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="display mt-1 bg-gradient-to-r from-amber-300 via-hot-500 to-brand-400 bg-clip-text text-5xl font-black text-transparent sm:text-6xl">
          🏆 {f.winnerName}
        </motion.div>
      </div>
      {f.teams && (
        <div className="mt-6 flex justify-center gap-3">
          {f.teams.map((t) => (
            <div key={t.team} className="card px-5 py-3 text-center">
              <div className="text-xs font-bold uppercase text-ink-400">#{t.rank} Team {t.name}</div>
              <div className="display text-2xl font-black text-white">{t.score}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-10 flex items-end justify-center gap-3">
        {order.map((i) => {
          const s = podium[i];
          const h = i === 0 ? "h-40" : i === 1 ? "h-28" : "h-20";
          return (
            <motion.div key={s.playerId} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + (2 - i) * 0.25 }} className="flex w-28 flex-col items-center sm:w-36">
              <Avatar avatar={s.avatar} photo={s.photo} color={s.color} size={i === 0 ? 72 : 56} ring={i === 0} />
              <div className="mt-2 max-w-full truncate font-bold text-white">{s.name}</div>
              <div className="text-sm text-ink-300 tabular-nums">{s.score}</div>
              <div className={`mt-2 grid w-full place-items-center rounded-t-2xl ${h} ${i === 0 ? "bg-gradient-to-b from-amber-400/40 to-amber-400/5" : i === 1 ? "bg-gradient-to-b from-slate-300/30 to-slate-300/5" : "bg-gradient-to-b from-orange-700/40 to-orange-700/5"}`}>
                <span className="display text-4xl font-black text-white/80">{i + 1}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="card mt-6 p-4">
        <ol className="flex flex-col gap-1.5">
          {f.standings.map((s) => (
            <li key={s.playerId} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.playerId === me ? "bg-brand-500/15" : ""}`}>
              <span className="w-6 text-center font-bold text-ink-400">{s.rank}</span>
              <Avatar avatar={s.avatar} photo={s.photo} color={s.color} size={30} dim={s.eliminated} />
              <span className="flex-1 font-semibold text-white">{s.name}</span>
              <span className="text-xs text-ink-400">{s.correct} correct</span>
              {s.rating && (
                <span className={`text-xs font-semibold ${s.rating.delta >= 0 ? "text-good-400" : "text-bad-400"}`}>
                  {s.rating.rating} ({s.rating.delta >= 0 ? "+" : ""}
                  {s.rating.delta})
                </span>
              )}
              {s.xp !== undefined && <span className="chip">+{s.xp} XP</span>}
              <span className="display w-16 text-right font-bold text-white tabular-nums">{s.score}</span>
            </li>
          ))}
        </ol>
      </div>
      {mine?.achievements && mine.achievements.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {mine.achievements.map((a) => (
            <span key={a.name} className="chip border-warn-400/40 px-3 py-1 text-sm text-warn-400">
              {a.icon} {a.name}
            </span>
          ))}
        </div>
      )}
      {mine?.levelUp && <div className="mt-3 text-center font-bold text-brand-400">⭐ Level up!</div>}
      <div className="mt-8 flex justify-center gap-3">
        {isHost ? (
          <>
            <button className="btn-primary px-8 py-3" onClick={() => void emit("room:start")}>
              🔁 Play again
            </button>
            <button className="btn-ghost px-6 py-3" onClick={() => void emit("room:end")}>
              Change settings
            </button>
          </>
        ) : (
          <div className="text-ink-400">Waiting for the host to start another game…</div>
        )}
      </div>
    </div>
  );
}
