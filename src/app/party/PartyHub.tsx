"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { emit } from "@/client/socket";
import { JoinCode } from "@/components/JoinCode";
import { GameGlyph } from "@/components/ui/GameGlyph";
import { Icon } from "@/components/ui/Icon";

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
  { slug: "roulette", group: "party", label: "Trivia Roulette", mode: "classic", desc: "A different subject every round." },
  { slug: "quickfire", group: "party", label: "Quickfire", mode: "chaos", desc: "Fast rounds with a twist each time." },
  { slug: "flags", group: "visual", label: "Flag battle", mode: "classic", desc: "Who knows the world best?" },
  { slug: "rare-words", group: "words", label: "Rare Words", mode: "classic", desc: "The rarer your answer, the more it scores." },
] as const;

export function PartyHub() {
  const router = useRouter();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
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
    <div className="mx-auto max-w-5xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
      <h1 className="serif text-[44px] leading-none text-fg sm:text-[52px]">Party</h1>
      <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-fg-2">Real-time rooms for up to twelve. Share a code, everyone plays on their own phone or laptop.</p>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
        <section aria-labelledby="host">
          <h2 id="host" className="text-[15px] font-semibold text-fg">
            Host a room
          </h2>
          <p className="mt-1 text-sm text-fg-3">Pick a starting point. You can change the game, rules and teams in the lobby.</p>
          <ul className="mt-5 flex flex-col">
            {QUICK.map((q) => (
              <li key={q.slug} className="border-b border-line first:border-t">
                <button disabled={!!busy} onClick={() => void create(q.slug, q.mode)} className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-[var(--radius-md)] px-3 py-4 text-left transition-colors hover:bg-surface-1 disabled:opacity-60">
                  <GameGlyph slug={q.slug} group={q.group} name={q.label} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fg">{q.label}</span>
                    <span className="block text-sm text-fg-3">{q.desc}</span>
                  </span>
                  {busy === q.slug + q.mode ? <span className="spinner" /> : <Icon name="arrow-right" size={18} className="text-fg-4 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-fg-2" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fg-3">Every party game can also be hosted from its own page in the library.</p>
          {err && (
            <p role="alert" className="mt-2 text-sm text-bad-400">
              {err}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="join" className="card p-6">
            <h2 id="join" className="mb-4 text-[15px] font-semibold text-fg">
              Join with a code
            </h2>
            <JoinCode />
          </section>

          <section aria-labelledby="open">
            <h2 id="open" className="flex items-center justify-between text-[15px] font-semibold text-fg">
              Open rooms
              {rooms && rooms.length > 0 && <span className="num text-sm font-normal text-fg-3">{rooms.length}</span>}
            </h2>
            {rooms === null ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="skeleton h-14" />
                <div className="skeleton h-14 opacity-60" />
              </div>
            ) : rooms.length ? (
              <ul className="mt-4 flex flex-col">
                {rooms.map((r) => (
                  <li key={r.code} className="border-b border-line first:border-t">
                    <button onClick={() => router.push(`/room/${r.code}`)} className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-left transition-colors hover:bg-surface-1">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg">{r.game}</span>
                        <span className="block truncate text-[13px] text-fg-3 capitalize">
                          {r.mode} · {r.host}
                        </span>
                      </span>
                      <span className="num text-sm text-fg-2">
                        {r.players}
                        <span className="text-fg-3">/{r.max}</span>
                      </span>
                      <span className="font-mono text-xs text-fg-3">{r.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-y border-line py-6 text-sm leading-relaxed text-fg-3">No public rooms right now. Rooms are private unless the host opens them in the lobby.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
