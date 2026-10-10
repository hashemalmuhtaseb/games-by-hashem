"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { emit } from "@/client/socket";
import { JoinCode } from "@/components/JoinCode";

interface PublicRoom {
  code: string;
  game?: string;
  icon?: string;
  mode: string;
  players: number;
  max: number;
  host?: string;
}

const QUICK = [
  { slug: "roulette", label: "Trivia Roulette", icon: "🎰", mode: "classic", desc: "Every round a different topic." },
  { slug: "quickfire", label: "Quickfire", icon: "⚡", mode: "chaos", desc: "Fast rounds with chaos twists." },
  { slug: "flags", label: "Flag battle", icon: "🚩", mode: "classic", desc: "Who knows the world best?" },
  { slug: "rare-words", label: "Rare Words", icon: "💎", mode: "classic", desc: "Think different to score big." },
] as const;

export function PartyHub() {
  const router = useRouter();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => emit<{ rooms: PublicRoom[] }>("rooms:list").then((r) => live && !r.error && setRooms(r.rooms));
    void load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  const create = async (gameSlug: string, mode: string) => {
    setBusy(gameSlug + mode);
    setErr(null);
    const r = await emit<{ code: string }>("room:create", { settings: { gameSlug, mode } });
    if (r.error) {
      setErr(r.error);
      setBusy(null);
    } else router.push(`/room/${r.code}`);
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="display text-4xl font-semibold text-fg sm:text-5xl">Party time 🥳</h1>
      <p className="mt-2 text-lg text-fg-2">Real-time rooms for 2–12 players. Share a code, pick a game, play on any device.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <h2 className="label mb-3">Host a room</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK.map((q) => (
              <button key={q.slug} disabled={!!busy} onClick={() => void create(q.slug, q.mode)} className="flex items-start gap-3 rounded-2xl border border-line bg-surface-1 p-4 text-left transition hover:border-brand-400/50 hover:bg-surface-2">
                <span className="text-3xl">{q.icon}</span>
                <span>
                  <span className="block font-bold text-fg">{busy === q.slug + q.mode ? "Creating…" : q.label}</span>
                  <span className="block text-sm text-fg-3">{q.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-fg-3">You can change the game, modes, teams, timers and rules in the lobby — or host any game from its page.</p>
          {err && <p className="mt-2 text-sm text-bad-400">{err}</p>}
        </div>
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <h2 className="label mb-3">Join with a code</h2>
            <JoinCode />
          </div>
          <div className="card p-6">
            <h2 className="label mb-3">Open rooms</h2>
            {rooms.length ? (
              <ul className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <button onClick={() => router.push(`/room/${r.code}`)} className="flex w-full items-center gap-3 rounded-xl bg-surface-1 px-3 py-2.5 text-left hover:bg-surface-2">
                      <span className="text-2xl">{r.icon}</span>
                      <span className="flex-1">
                        <span className="block font-semibold text-fg">{r.game}</span>
                        <span className="block text-xs text-fg-3 capitalize">
                          {r.mode} · hosted by {r.host}
                        </span>
                      </span>
                      <span className="chip">
                        {r.players}/{r.max}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">No public rooms right now. Rooms are private by default — hosts can open theirs in the lobby.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
