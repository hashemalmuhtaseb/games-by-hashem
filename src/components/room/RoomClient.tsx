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
import { GameGlyph } from "@/components/ui/GameGlyph";
import { Icon } from "@/components/ui/Icon";
import { plainLabel } from "@/components/ui/text";
import { CountUp } from "@/components/ui/CountUp";
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
      <div className="grid min-h-dvh place-items-center px-5">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-fg-2">
            <Icon name="users" size={22} />
          </div>
          <p className="mt-5 text-[17px] text-fg">{error}</p>
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
        <div className="flex flex-col items-center gap-4 text-sm text-fg-3">
          <div className="spinner" />
          <span>
            Joining room <span className="font-mono text-fg-2">{code}</span>
          </span>
        </div>
      </div>
    );

  const isHost = state.hostId === me;
  const myPlayer = state.players.find((p) => p.id === me);
  const spectating = !myPlayer || myPlayer.spectator || myPlayer.eliminated;
  const inGame = state.phase === "question" || state.phase === "reveal" || state.phase === "countdown" || state.phase === "stage";
  const modeLabel = state.settings.mode.charAt(0).toUpperCase() + state.settings.mode.slice(1);

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 pb-6 sm:px-8">
      <header className="sticky top-0 z-30 -mx-5 flex h-16 items-center gap-3 bg-canvas/90 px-5 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:-mx-8 sm:px-8">
        <button onClick={leave} className="btn-icon -ml-2" aria-label="Leave room">
          <Icon name="x" size={20} />
        </button>
        {state.game && <GameGlyph slug={state.settings.gameSlug} name={state.game.name} size={32} />}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-semibold text-fg">{state.game?.name}</div>
          <div className="num truncate text-[13px] text-fg-3">
            <span className="font-mono text-fg-2">{state.code}</span> · {modeLabel}
            {inGame && state.index >= 0 && ` · Round ${state.index + 1}${state.totalRounds ? ` of ${state.totalRounds}` : ""}`}
            {state.stageGames.length > 0 && ` · Stage ${state.stage + 1} of ${state.stageGames.length}`}
          </div>
        </div>
        {!connected && (
          <span className="flex items-center gap-1.5 text-[13px] text-warn-400" role="status">
            <span className="spinner h-3 w-3 border-[1.5px]" />
            Reconnecting
          </span>
        )}
        {myPlayer && inGame && !myPlayer.spectator ? (
          <div className="text-right leading-none">
            <CountUp value={myPlayer.score} className="display num block text-[22px] font-semibold text-fg" />
            <span className="num text-[11px] text-fg-3">
              #{state.players.filter((p) => !p.spectator && p.score > myPlayer.score).length + 1} of {state.players.filter((p) => !p.spectator).length}
            </span>
          </div>
        ) : (
          myPlayer && <Avatar avatar={myPlayer.avatar} color={myPlayer.color} size={30} />
        )}
      </header>

      {/* Floating reactions: drift up and fade, no bounce. */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div key={r.id} initial={{ y: "92vh", opacity: 0 }} animate={{ y: "52vh", opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, ease: [0.2, 0.8, 0.2, 1] }} className="absolute flex flex-col items-center gap-1" style={{ left: `${r.x}%` }}>
              <span className="text-4xl">{r.emoji}</span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">{r.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {state.phase === "lobby" && (
        <div className="grid flex-1 gap-6 pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Lobby state={state} me={me} />
          <aside className="card hidden h-[680px] p-4 xl:block">
            <Chat messages={chat} enabled={state.settings.chat} me={me} />
          </aside>
        </div>
      )}

      {inGame && (
        <div className="grid flex-1 gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-w-0 flex-col gap-6">
            {state.phase === "countdown" && <Countdown endsAt={state.phaseEndsAt} offset={offset} title={state.stageGames.length ? `Stage ${state.stage + 1}: ${state.stageGames[state.stage]?.name}` : "Get ready"} />}
            {state.phase === "stage" && <StageBreak state={state} />}
            {(state.phase === "question" || state.phase === "reveal") && round && (
              <>
                {state.phase === "question" ? (
                  <TimerBar deadline={round.deadline} offset={offset} total={round.round.timeLimitSec} paused={state.paused} />
                ) : (
                  <NextBar endsAt={state.phaseEndsAt} offset={offset} />
                )}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-fg-3">
                  <span className="font-medium text-fg-2">{plainLabel(round.round.modeLabel)}</span>
                  <span className="flex gap-[3px]" aria-label={`Difficulty ${round.round.difficulty} of 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={`h-2.5 w-[3px] rounded-full ${i < round.round.difficulty ? "bg-fg-2" : "bg-surface-4"}`} />
                    ))}
                  </span>
                  {round.modifier && <span className="chip bg-accent-soft font-medium text-accent">{round.modifier.label}</span>}
                  {spectating && (
                    <span className="flex items-center gap-1.5">
                      <Icon name="eye" size={14} />
                      Spectating
                    </span>
                  )}
                  {state.paused && (
                    <span className="flex items-center gap-1.5 text-warn-400">
                      <Icon name="pause" size={14} />
                      Paused
                    </span>
                  )}
                </div>
                {round.notice && <div className="text-center text-sm text-warn-400">{round.notice}</div>}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={round.round.roundId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
                    className="flex flex-col items-center gap-6"
                  >
                    <RoundPlayer round={round.round} act={act} locked={spectating || !!mine?.done || state.paused} reveal={reveal} resume={resume} />
                    {mine?.done && !reveal && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-fg-2" role="status">
                        <Icon name="check" size={16} className="text-good-400" />
                        Locked in{mine.points !== undefined ? <span className="num">, {mine.points > 0 ? "+" : ""}{mine.points}</span> : null}. Waiting for everyone else.
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
              <div className="mt-auto flex flex-wrap justify-center gap-2 border-t border-line pt-5">
                <span className="mr-2 self-center text-[13px] text-fg-3">Host</span>
                {state.phase === "question" && (
                  <button className="btn-ghost btn-sm" onClick={() => void emit("room:pause", { pause: !state.paused })}>
                    <Icon name={state.paused ? "play" : "pause"} size={14} />
                    {state.paused ? "Resume" : "Pause"}
                  </button>
                )}
                {(state.phase === "question" || state.phase === "reveal") && (
                  <button className="btn-ghost btn-sm" onClick={() => void emit("room:skip")}>
                    <Icon name="arrow-right" size={15} />
                    {state.phase === "question" ? "Reveal now" : "Next round"}
                  </button>
                )}
                <button className="btn-danger btn-sm" onClick={() => confirm("End the game for everyone?") && void emit("room:end")}>
                  End game
                </button>
              </div>
            )}
          </section>
          <aside className="flex flex-col gap-4">
            <div className="card p-3">
              <Scoreboard state={state} me={me} showAnswered={state.phase === "question"} />
            </div>
            <div className="card hidden h-80 p-4 lg:block">
              <Chat messages={chat} enabled={state.settings.chat} me={me} />
            </div>
          </aside>
        </div>
      )}

      {state.phase === "results" && state.final && <Results state={state} me={me} isHost={isHost} />}

      {/* Phone chat: a sheet that rises from the bottom. */}
      <button
        className="btn-ghost fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 h-12 w-12 rounded-full p-0 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.6)] lg:hidden"
        onClick={() => {
          setChatOpen((o) => !o);
          setUnread(0);
        }}
        aria-label={chatOpen ? "Close chat" : "Open chat"}
        aria-expanded={chatOpen}
      >
        <Icon name={chatOpen ? "x" : "chat"} size={20} />
        {unread > 0 && !chatOpen && <span className="num absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-ink">{unread}</span>}
      </button>
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.6 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className="popover fixed inset-x-2 bottom-20 z-40 h-[min(28rem,70dvh)] p-4 lg:hidden"
          >
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
    <div className="grid flex-1 place-items-center py-24">
      <div className="text-center">
        <div className="text-[15px] text-fg-3">{title}</div>
        <div className="relative mt-4 h-[160px]">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={n}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className="display num text-[160px] leading-none font-semibold tracking-[-0.05em] text-fg"
            >
              {n > 0 ? n : "Go"}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function NextBar({ endsAt, offset }: { endsAt: number | null; offset: number }) {
  const left = useCountdown(endsAt, offset);
  return (
    <div className="num text-center text-[13px] text-fg-3">
      Next round in <span className="font-mono text-fg-2">{Math.ceil(left)}</span>
    </div>
  );
}

function StageBreak({ state }: { state: RoomSnapshot }) {
  const next = state.stageGames[state.stage + 1];
  const out = state.players.filter((p) => p.eliminated);
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <div className="overline">Stage {state.stage + 1} complete</div>
      {out.length > 0 && <div className="mt-4 text-[17px] text-bad-400">Knocked out: {out.map((p) => p.name).join(", ")}</div>}
      {next && (
        <div className="mt-10">
          <div className="label">Next up</div>
          <div className="serif mt-2 text-[40px] leading-tight text-fg">{next.name}</div>
        </div>
      )}
    </div>
  );
}

function AnswersList({ reveal, state }: { reveal: RoomReveal; state: RoomSnapshot }) {
  const results = reveal.extra?.results ?? [];
  if (!results.length) return null;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  return (
    <div className="w-full max-w-2xl">
      <div className="label mb-2">Everyone&apos;s answers</div>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {results
          .slice()
          .sort((a, b) => b.points - a.points)
          .map((r) => {
            const p = byId.get(r.playerId);
            if (!p) return null;
            return (
              <li key={r.playerId} className="flex items-center gap-3 border-t border-line py-2.5 text-sm">
                <Avatar avatar={p.avatar} color={p.color} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{p.name}</span>
                  <span className={`block truncate text-[13px] ${r.correct ? "text-good-400" : "text-fg-3"}`}>{r.answer ?? "No answer"}</span>
                </span>
                <span className={`num font-semibold ${r.correct ? "text-good-400" : r.points < 0 ? "text-bad-400" : "text-fg-3"}`}>
                  {r.points > 0 ? "+" : ""}
                  {r.points}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function Results({ state, me, isHost }: { state: RoomSnapshot; me: string; isHost: boolean }) {
  const f = state.final!;
  const podium = f.standings.slice(0, 3);
  const mine = f.standings.find((s) => s.playerId === me);
  const order = [1, 0, 2].filter((i) => podium[i]);
  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }} className="text-center">
        <div className="overline">Winner</div>
        <h1 className="serif mt-3 text-[48px] leading-none text-fg sm:text-[60px]">{f.winnerName}</h1>
      </motion.div>
      {f.teams && (
        <div className="mt-8 flex justify-center gap-2">
          {f.teams.map((t) => (
            <div key={t.team} className="well px-5 py-3 text-center">
              <div className="text-xs text-fg-3">
                #{t.rank} · Team {t.name}
              </div>
              <div className="display num text-2xl font-semibold text-fg">{t.score}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-12 flex items-end justify-center gap-2 sm:gap-3">
        {order.map((i) => {
          const s = podium[i];
          const h = i === 0 ? "h-36" : i === 1 ? "h-24" : "h-16";
          return (
            <motion.div key={s.playerId} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + (2 - i) * 0.12, duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }} className="flex w-28 flex-col items-center sm:w-36">
              <Avatar avatar={s.avatar} color={s.color} size={i === 0 ? 64 : 48} ring={i === 0} />
              <div className="mt-3 max-w-full truncate text-sm font-semibold text-fg">{s.name}</div>
              <div className="num text-[13px] text-fg-3">{s.score.toLocaleString()}</div>
              <div className={`mt-3 flex w-full justify-center rounded-t-[var(--radius-md)] pt-3 ${h} ${i === 0 ? "bg-[color-mix(in_oklab,var(--color-accent)_16%,var(--color-surface-1))] shadow-[inset_0_1px_0_var(--color-accent-line)]" : "bg-surface-2 shadow-[inset_0_1px_0_var(--color-line-strong)]"}`}>
                <span className={`display num text-2xl font-semibold ${i === 0 ? "text-accent" : "text-fg-3"}`}>{i + 1}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      <ol className="mt-0 border-t border-line">
        {f.standings.map((s) => (
          <li key={s.playerId} className={`flex items-center gap-3 border-b border-line px-3 py-3 ${s.playerId === me ? "bg-accent-soft" : ""}`}>
            <span className="num w-6 text-center font-mono text-sm text-fg-3">{s.rank}</span>
            <Avatar avatar={s.avatar} color={s.color} size={30} dim={s.eliminated} />
            <span className="min-w-0 flex-1 truncate font-medium text-fg">
              {s.name}
              {s.playerId === me && <span className="ml-2 text-xs text-fg-3">You</span>}
            </span>
            <span className="num hidden text-[13px] text-fg-3 sm:inline">{s.correct} correct</span>
            {s.rating && (
              <span className={`num text-[13px] ${s.rating.delta >= 0 ? "text-good-400" : "text-bad-400"}`}>
                {s.rating.rating} ({s.rating.delta >= 0 ? "+" : "−"}
                {Math.abs(s.rating.delta)})
              </span>
            )}
            {s.xp !== undefined && <span className="num hidden text-[13px] text-fg-3 sm:inline">+{s.xp} XP</span>}
            <span className="display num w-16 text-right font-semibold text-fg">{s.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      {mine?.achievements && mine.achievements.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {mine.achievements.map((a) => (
            <span key={a.name} className="well flex items-center gap-2 px-3 py-2 text-sm text-fg">
              <span aria-hidden>{a.icon}</span>
              {a.name}
            </span>
          ))}
        </div>
      )}
      {mine?.levelUp && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-fg-2">
          <Icon name="star" size={16} className="text-accent" />
          Level up
        </div>
      )}
      <div className="mt-10 flex justify-center gap-2">
        {isHost ? (
          <>
            <button className="btn-primary btn-lg" onClick={() => void emit("room:start")}>
              <Icon name="refresh" size={17} />
              Play again
            </button>
            <button className="btn-ghost btn-lg" onClick={() => void emit("room:end")}>
              Change settings
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-fg-3">
            <span className="spinner h-3.5 w-3.5 border-[1.5px]" />
            Waiting for the host to start another game
          </div>
        )}
      </div>
    </div>
  );
}
