"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { emit } from "@/client/socket";

const RULES = [
  "Each player gets two private cards. Five shared cards are dealt in stages: the flop (3), the turn (1) and the river (1).",
  "Make the best five-card hand from your two cards and the five on the table. Bet, call, raise, check or fold as each round comes to you.",
  "Hands from best to worst: Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card.",
  "Blinds rise over time so every game finishes. Lose all your chips and you're out; the last player with chips wins.",
  "Chips are virtual and reset every game. Nothing can be bought, cashed out or won.",
];

export function PokerHome() {
  const router = useRouter();
  const [bots, setBots] = useState(3);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async (solo: boolean) => {
    setBusy(true);
    setErr(null);
    const r = await emit<{ code: string }>("poker:create", { solo, bots: solo ? bots : 0 });
    setBusy(false);
    if (r.error) return setErr(r.error);
    router.push(`/poker/${r.code}`);
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#17543e] text-3xl ring-1 ring-white/10">♠</span>
        <div>
          <h1 className="display text-4xl font-black text-white">Texas Hold&apos;em</h1>
          <p className="mt-1 text-ink-300">No-limit poker for 2–8 players with virtual chips. Play the computer or open a private table for friends.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-6">
          <h2 className="label mb-3">How it works</h2>
          <ul className="space-y-2.5 text-ink-100">
            {RULES.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-ink-300">{i + 1}</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <div className="card p-6">
            <h2 className="label">Solo</h2>
            <p className="mt-1 text-sm text-ink-300">You against computer players.</p>
            <div className="mt-4 flex items-center gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-ink-400">Opponents</span>
                <select className="input py-2" value={bots} onChange={(e) => setBots(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "opponent (heads-up)" : "opponents"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary self-end px-6 py-3" disabled={busy} onClick={() => void create(true)}>
                Play
              </button>
            </div>
          </div>
          <div className="card p-6">
            <h2 className="label">Private table</h2>
            <p className="mt-1 text-sm text-ink-300">Open a table, share the code, and add computer players to fill empty seats.</p>
            <button className="btn-ghost mt-4 w-full py-3" disabled={busy} onClick={() => void create(false)}>
              Create a private table
            </button>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const c = joinCode.trim().toUpperCase();
                if (/^P[A-Z0-9]{4}$/.test(c)) router.push(`/poker/${c}`);
                else setErr("Table codes look like P7KQ2.");
              }}
            >
              <input className="input py-2 font-mono tracking-widest uppercase" placeholder="Table code" maxLength={5} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} aria-label="Table code" />
              <button className="btn-ghost px-5">Join</button>
            </form>
          </div>
          {err && <p className="text-sm text-bad-400">{err}</p>}
        </div>
      </div>
    </div>
  );
}
