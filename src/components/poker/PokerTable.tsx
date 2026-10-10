"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit, getSocket } from "@/client/socket";
import { play } from "@/client/sound";
import { burst } from "@/client/confetti";
import { Avatar } from "@/components/Avatar";
import type { PokerMeta } from "@/server/poker";
import type { SeatView, TableView } from "@/poker/table";
import { PlayingCard } from "./PlayingCard";

interface PokerState {
  meta: PokerMeta;
  view: TableView;
  you: string | null;
}

const STREET_LABEL: Record<string, string> = { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown" };

/** Seat positions around the table (percent of the felt), starting bottom-centre and going clockwise. */
function seatPosition(slot: number, n: number) {
  const a = Math.PI / 2 + (slot * 2 * Math.PI) / n;
  return { left: `${50 + 46 * Math.cos(a)}%`, top: `${50 + 42 * Math.sin(a)}%` };
}

function useClock(deadline: number | null, offset: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return setLeft(0);
    const t = setInterval(() => setLeft(Math.max(0, (deadline - (Date.now() + offset)) / 1000)), 200);
    return () => clearInterval(t);
  }, [deadline, offset]);
  return left;
}

export function PokerTable({ code }: { code: string }) {
  const router = useRouter();
  const [st, setSt] = useState<PokerState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const lastHand = useRef<number>(0);
  const lastTurn = useRef<string>("");

  const join = useCallback(async () => {
    const r = await emit<PokerState>("poker:join", { code });
    if (r.error) return setErr(r.error);
    setErr(null);
    setSt(r);
    setOffset(r.meta.serverNow - Date.now());
  }, [code]);

  useEffect(() => {
    const s = getSocket();
    const onState = (x: PokerState) => {
      setSt(x);
      setOffset(x.meta.serverNow - Date.now());
    };
    s.on("connect", join);
    s.on("poker:state", onState);
    if (s.connected) void join();
    return () => {
      s.off("connect", join);
      s.off("poker:state", onState);
    };
  }, [join]);

  // Sounds and celebrations.
  useEffect(() => {
    const h = st?.view.hand;
    if (!h || !st) return;
    if (h.no !== lastHand.current) {
      lastHand.current = h.no;
      play("start");
    }
    const mySeat = st.view.you.seat;
    const turnKey = `${h.no}:${h.street}:${h.toAct}`;
    if (turnKey !== lastTurn.current) {
      lastTurn.current = turnKey;
      if (h.toAct !== null && h.toAct === mySeat) play("tick");
      if (h.street === "showdown" && h.result && st.you && h.result.winnings[st.you]) {
        play("win");
        burst("small");
      }
    }
  }, [st]);

  const act = async (a: Record<string, unknown>) => {
    const r = await emit("poker:act", a);
    if (r.error) {
      setToast(r.error);
      setTimeout(() => setToast(null), 2500);
    } else play("click");
  };

  if (err)
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card max-w-md p-8 text-center">
          <p className="text-lg text-white">{err}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/poker" className="btn-ghost">
              Poker lobby
            </Link>
            <button className="btn-primary" onClick={() => void join()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  if (!st)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-brand-400" />
          Taking a seat…
        </div>
      </div>
    );

  const { meta, view } = st;
  const isHost = meta.hostId === st.you;
  const leave = async () => {
    await emit("poker:leave");
    router.push("/poker");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 pb-40 sm:px-4 sm:pb-8">
      <header className="flex items-center gap-3 py-3">
        <button onClick={leave} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-white" aria-label="Leave table">
          ←
        </button>
        <div className="flex-1 leading-tight">
          <div className="display font-bold text-white">Texas Hold&apos;em</div>
          <div className="text-xs text-ink-400">
            {meta.solo ? "Solo vs computer" : <>Table <b className="font-mono tracking-wider text-ink-300">{meta.code}</b></>} · blinds {view.blinds.sb}/{view.blinds.bb}
            {view.hand && ` · hand #${view.hand.no}`} · virtual chips only
          </div>
        </div>
      </header>

      {meta.phase === "lobby" && <PokerLobbyPanel st={st} isHost={isHost} />}
      {meta.phase !== "lobby" && <Felt st={st} offset={offset} />}
      {meta.phase === "playing" && <ActionBar st={st} act={act} offset={offset} />}
      {meta.phase === "finished" && <Finished st={st} isHost={isHost} />}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed inset-x-0 bottom-44 z-50 mx-auto w-fit rounded-xl bg-bad-500/90 px-4 py-2 text-sm font-semibold text-white shadow-xl sm:bottom-8" role="alert">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── lobby ─────────────────────────

function PokerLobbyPanel({ st, isHost }: { st: PokerState; isHost: boolean }) {
  const { meta, view } = st;
  const seated = view.seats.filter((s): s is SeatView => !!s);
  const mine = seated.some((s) => s.id === st.you);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (event: string, data: unknown = {}) => {
    const r = await emit(event, data);
    setErr(r.error ?? null);
  };
  const s = meta.settings;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="label">Players ({seated.length}/{s.maxSeats})</h2>
          {!meta.solo && (
            <button
              className="btn-ghost px-3 py-1.5 text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(`${location.origin}/poker/${meta.code}`).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Link copied" : `Invite · ${meta.code}`}
            </button>
          )}
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {seated.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <Avatar avatar={p.avatar} photo={p.photo} color={p.color} size={34} dim={!p.connected && !p.bot} />
              <span className="flex-1 font-semibold text-white">
                {p.name}
                {p.id === meta.hostId && <span className="ml-2 text-xs text-ink-400">host</span>}
              </span>
              <span className="text-sm text-ink-300 tabular-nums">{p.stack.toLocaleString()} chips</span>
            </li>
          ))}
        </ul>
        {meta.spectators.length > 0 && <div className="mt-3 text-xs text-ink-400">Watching: {meta.spectators.map((x) => x.name).join(", ")}</div>}
        <div className="mt-5 flex flex-wrap gap-2">
          {isHost && (
            <>
              <button className="btn-ghost text-sm" onClick={() => void run("poker:add-bot")} disabled={seated.length >= s.maxSeats}>
                + Add computer player
              </button>
              <button className="btn-ghost text-sm" onClick={() => void run("poker:remove-bot")} disabled={!seated.some((p) => p.bot)}>
                − Remove computer player
              </button>
            </>
          )}
          {!meta.solo && !mine && (
            <button className="btn-ghost text-sm" onClick={() => void run("poker:sit")}>
              Take a seat
            </button>
          )}
          {!meta.solo && mine && !isHost && (
            <button className="btn-ghost text-sm" onClick={() => void run("poker:stand")}>
              Watch instead
            </button>
          )}
        </div>
        {err && <p className="mt-3 text-sm text-bad-400">{err}</p>}
      </div>
      <div className="card flex flex-col gap-4 p-6">
        <h2 className="label">Table settings</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Setting label="Starting chips" value={s.startingStack} options={[500, 1000, 1500, 2500, 5000, 10000]} disabled={!isHost} onChange={(v) => void run("poker:settings", { startingStack: v })} />
          <Setting label="Big blind" value={s.bigBlind} options={[10, 20, 50, 100]} disabled={!isHost} onChange={(v) => void run("poker:settings", { bigBlind: v })} />
          <Setting label="Blinds double every" value={s.levelHands} options={[0, 5, 10, 15, 20]} format={(v) => (v ? `${v} hands` : "Never")} disabled={!isHost} onChange={(v) => void run("poker:settings", { levelHands: v })} />
          <Setting label="Time per move" value={s.turnSec} options={[15, 20, 30, 45, 60]} format={(v) => `${v}s`} disabled={!isHost} onChange={(v) => void run("poker:settings", { turnSec: v })} />
        </div>
        <p className="text-xs text-ink-400">Chips are virtual and reset every game. Nothing can be bought, cashed out or won.</p>
        {isHost ? (
          <button className="btn-primary mt-auto py-3 text-lg" onClick={() => void run("poker:start")} disabled={seated.length < 2}>
            Deal
          </button>
        ) : (
          <div className="mt-auto text-center text-sm text-ink-400">Waiting for the host to deal…</div>
        )}
      </div>
    </div>
  );
}

function Setting({ label, value, options, disabled, onChange, format }: { label: string; value: number; options: number[]; disabled: boolean; onChange: (v: number) => void; format?: (v: number) => string }) {
  const opts = [...new Set([...options, value])].sort((a, b) => a - b);
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select className="input py-2" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
        {opts.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o.toLocaleString()}
          </option>
        ))}
      </select>
    </label>
  );
}

// ───────────────────────── felt ─────────────────────────

function Felt({ st, offset }: { st: PokerState; offset: number }) {
  const { view, meta } = st;
  const h = view.hand;
  const n = view.seats.length;
  const mySeat = view.you.seat;
  const left = useClock(meta.deadline, offset);
  const winners = new Set(h?.result ? Object.keys(h.result.winnings) : []);
  const shownBest = useMemo(() => new Map((h?.result?.shown ?? []).map((s) => [s.id, s])), [h?.result]);
  const winningCards = new Set(h?.result ? h.result.shown.filter((s) => winners.has(s.id)).flatMap((s) => s.cards) : []);
  return (
    <div className="relative mx-auto mt-2 aspect-[16/11] w-full max-w-4xl sm:aspect-[16/9]">
      {/* table */}
      <div className="absolute inset-[9%_6%] rounded-[50%] border-[10px] border-[#2a2219] bg-[radial-gradient(ellipse_at_center,#1f6b4f_0%,#17543e_55%,#11402f_100%)] shadow-[inset_0_0_40px_rgb(0_0_0/0.45),0_20px_50px_-20px_rgb(0_0_0/0.8)]" />
      {/* centre: board + pot */}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        {h && (
          <div className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold tracking-wide text-white/80">
            {STREET_LABEL[h.street]} · Pot <span className="tabular-nums">{h.pot.toLocaleString()}</span>
          </div>
        )}
        <div className="flex gap-1 sm:gap-1.5">
          {Array.from({ length: 5 }, (_, i) => {
            const c = h?.board[i];
            return c ? (
              <PlayingCard key={`${h!.no}-${c}`} code={c} size="md" delay={i * 0.06} highlight={h?.street === "showdown" && winningCards.has(c)} dim={h?.street === "showdown" && winningCards.size > 0 && !winningCards.has(c)} />
            ) : (
              <div key={i} className="h-16 w-12 rounded-lg border border-dashed border-white/15" />
            );
          })}
        </div>
        {h?.result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-xs text-center text-sm font-semibold text-amber-200">
            {h.result.pots.map((p, i) => {
              const names = p.winners.map((id) => view.seats.find((s) => s?.id === id)?.name ?? "?").join(" & ");
              return (
                <div key={i}>
                  {names} {p.winners.length > 1 ? "split" : "win"} {p.amount.toLocaleString()}
                  {h.result!.pots.length > 1 ? (i === 0 ? " (main pot)" : ` (side pot ${i})`) : ""}
                  {p.hand ? ` · ${p.hand}` : ""}
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
      {/* seats */}
      {view.seats.map((s, i) => {
        if (!s) return null;
        const slot = mySeat !== null ? (i - mySeat + n) % n : i;
        const pos = seatPosition(slot, n);
        const turn = h?.toAct === i;
        const won = winners.has(s.id);
        const shown = shownBest.get(s.id);
        return (
          <div key={s.id} className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:w-32" style={pos}>
            <div className="flex gap-0.5">
              {s.hole ? s.hole.map((c, k) => <PlayingCard key={c} code={c} size="sm" delay={k * 0.05} dim={s.folded} highlight={won && winningCards.has(c)} />) : Array.from({ length: s.cardsDown }, (_, k) => <PlayingCard key={k} faceDown size="sm" delay={k * 0.05} />)}
            </div>
            <motion.div
              animate={won ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.6 }}
              className={`relative flex w-full items-center gap-2 rounded-xl px-2 py-1.5 ${turn ? "bg-amber-300/20 ring-2 ring-amber-300" : won ? "bg-good-500/20 ring-2 ring-good-400" : "bg-ink-900/85 ring-1 ring-white/10"} ${s.folded || s.out ? "opacity-50" : ""}`}
            >
              <Avatar avatar={s.avatar} photo={s.photo} color={s.color} size={30} dim={!s.connected && !s.bot} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold text-white">{s.name}</div>
                <div className="text-xs text-ink-300 tabular-nums">{s.out ? "Out" : s.stack.toLocaleString()}</div>
              </div>
              {s.isButton && <span className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-black text-ink-950 shadow" title="Dealer button">D</span>}
              {turn && meta.deadline && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-1.5 text-[10px] font-bold text-ink-950 tabular-nums">{Math.ceil(left)}s</span>}
            </motion.div>
            <div className="h-4 text-[11px] font-semibold text-white/80">
              {shown ? <span className="text-amber-200">{shown.hand}</span> : s.lastAction ? s.lastAction : s.isSB ? "SB" : s.isBB ? "BB" : ""}
              {s.bet > 0 && <span className="ml-1 rounded-full bg-black/40 px-1.5 tabular-nums">{s.bet.toLocaleString()}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── actions ─────────────────────────

function ActionBar({ st, act, offset }: { st: PokerState; act: (a: Record<string, unknown>) => Promise<void>; offset: number }) {
  const legal = st.view.you.legal;
  const h = st.view.hand;
  const [to, setTo] = useState(0);
  const left = useClock(st.meta.deadline, offset);
  useEffect(() => {
    if (legal) setTo(legal.minRaiseTo);
  }, [legal?.minRaiseTo, h?.no, h?.street]); // eslint-disable-line react-hooks/exhaustive-deps
  const mySeat = st.view.you.seat;
  const me = mySeat !== null ? st.view.seats[mySeat] : null;
  if (!me) return <div className="mt-4 text-center text-sm text-ink-400">You&apos;re watching this game.</div>;
  if (me.out) return <div className="mt-4 text-center text-sm text-ink-400">You&apos;re out of chips. You can keep watching.</div>;
  if (!legal)
    return (
      <div className="mt-4 text-center text-sm text-ink-400">
        {h?.street === "showdown" ? "Next hand in a moment…" : me.folded ? "You folded this hand." : h?.toAct !== null ? `Waiting for ${st.view.seats[h!.toAct!]?.name ?? "…"}` : ""}
      </div>
    );
  const pot = legal.pot;
  const clamp = (v: number) => Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(v)));
  const presets: [string, number][] = [
    ["½ pot", clamp(legal.currentBet + (pot + legal.call) / 2)],
    ["¾ pot", clamp(legal.currentBet + ((pot + legal.call) * 3) / 4)],
    ["Pot", clamp(legal.currentBet + pot + legal.call)],
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-4 sm:rounded-2xl sm:border sm:bg-ink-900/70">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-400">
          <span>Your turn · {Math.ceil(left)}s</span>
          <span className="tabular-nums">Stack {legal.stack.toLocaleString()}</span>
        </div>
        {legal.canRaise && (
          <div className="flex items-center gap-2">
            <input type="range" min={legal.minRaiseTo} max={legal.maxRaiseTo} step={1} value={to || legal.minRaiseTo} onChange={(e) => setTo(Number(e.target.value))} className="flex-1 accent-amber-400" aria-label={`${legal.raiseLabel} amount`} />
            <input className="input w-24 px-2 py-1.5 text-center tabular-nums" inputMode="numeric" value={to} onChange={(e) => setTo(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Amount" />
          </div>
        )}
        {legal.canRaise && (
          <div className="flex gap-1.5">
            {presets.map(([l, v]) => (
              <button key={l} className="btn-ghost flex-1 px-2 py-1.5 text-xs" onClick={() => setTo(v)}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-danger py-3" onClick={() => void act({ type: "fold" })}>
            Fold
          </button>
          {legal.check ? (
            <button className="btn-ghost py-3" onClick={() => void act({ type: "check" })}>
              Check
            </button>
          ) : (
            <button className="btn-ghost py-3" onClick={() => void act({ type: "call" })}>
              {legal.call >= legal.stack ? `All-in ${legal.stack.toLocaleString()}` : `Call ${legal.call.toLocaleString()}`}
            </button>
          )}
          {legal.canRaise ? (
            <button className="btn-primary py-3" onClick={() => void act(to >= legal.maxRaiseTo ? { type: "allin" } : { type: "raise", to: clamp(to) })}>
              {to >= legal.maxRaiseTo ? "All-in" : `${legal.raiseLabel === "bet" ? "Bet" : "Raise to"} ${clamp(to).toLocaleString()}`}
            </button>
          ) : (
            <button className="btn-ghost py-3" disabled>
              {legal.raiseLabel === "bet" ? "Bet" : "Raise"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── finished ─────────────────────────

function Finished({ st, isHost }: { st: PokerState; isHost: boolean }) {
  const f = st.meta.final ?? [];
  const winner = f.filter((x) => x.rank === 1);
  return (
    <div className="card mx-auto mt-6 w-full max-w-lg p-6 text-center">
      <div className="label">Winner</div>
      <div className="display mt-1 text-3xl font-black text-white">{winner.map((w) => w.name).join(" & ") || "—"}</div>
      <ol className="mt-5 flex flex-col gap-1.5 text-left">
        {f.map((s) => (
          <li key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.id === st.you ? "bg-brand-500/15" : "bg-white/[0.03]"}`}>
            <span className="w-6 text-center font-bold text-ink-400">{s.rank}</span>
            <span className="flex-1 font-semibold text-white">{s.name}</span>
            <span className="tabular-nums text-ink-300">{s.stack.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex justify-center gap-2">
        {isHost ? (
          <button className="btn-primary px-6" onClick={() => void emit("poker:start")}>
            Play again
          </button>
        ) : (
          <span className="text-sm text-ink-400">Waiting for the host…</span>
        )}
        <Link href="/poker" className="btn-ghost">
          Lobby
        </Link>
      </div>
    </div>
  );
}
