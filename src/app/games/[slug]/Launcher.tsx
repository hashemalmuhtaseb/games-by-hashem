"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GameInfo } from "@/engine/registry";
import { emit } from "@/client/socket";

const VARIANTS = [
  { id: "classic", label: "Classic", icon: "🎯", desc: "A standard game with adaptive difficulty." },
  { id: "survival", label: "Survival", icon: "❤️", desc: "Three lives. Gets harder every round. How far can you go?" },
  { id: "ranked", label: "Ranked", icon: "🏆", desc: "10 standard rounds that move your rating." },
  { id: "chaos", label: "Chaos", icon: "🌀", desc: "Random twists: double points, half time, jackpots, mystery rounds." },
] as const;

export function Launcher({ game }: { game: GameInfo }) {
  const router = useRouter();
  const available = game.modes.filter((m) => m.available);
  const unavailable = game.modes.filter((m) => !m.available);
  const [modes, setModes] = useState<string[]>([]);
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]["id"]>("classic");
  const [hosting, setHosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setModes((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const qs = () => {
    const p = new URLSearchParams({ variant });
    if (modes.length && variant !== "ranked") p.set("modes", modes.join(","));
    return p.toString();
  };
  return (
    <div className="card flex flex-col gap-6 p-6">
      {available.length > 1 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="label">Modes</h2>
            <span className="text-xs text-ink-400">{modes.length ? `${modes.length} selected` : "All modes mixed"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((m) => (
              <button
                key={m.id}
                title={m.description}
                onClick={() => toggle(m.id)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${modes.includes(m.id) ? "border-brand-400 bg-brand-500/20 text-white" : "border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/25 hover:text-white"}`}
              >
                <span className="font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
          {unavailable.length > 0 && (
            <p className="mt-2 text-xs text-ink-400">
              Not available yet: {unavailable.map((m) => m.label).join(", ")} — these need a licensed media source and are switched off rather than faked.
            </p>
          )}
        </div>
      )}
      <div>
        <h2 className="label mb-2">Solo variant</h2>
        <div className="grid grid-cols-2 gap-2">
          {VARIANTS.map((v) => (
            <button key={v.id} onClick={() => setVariant(v.id)} className={`rounded-xl border p-3 text-left transition ${variant === v.id ? "border-brand-400 bg-brand-500/15" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
              <div className="font-semibold text-white">
                {v.icon} {v.label}
              </div>
              <div className="mt-0.5 text-xs text-ink-400">{v.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary flex-1 py-3.5 text-lg" onClick={() => router.push(`/play/${game.slug}?${qs()}`)}>
          ▶ Play solo
        </button>
        {game.multiplayer && !game.soloOnly && (
          <button
            className="btn-ghost flex-1 py-3.5 text-lg"
            disabled={hosting}
            onClick={async () => {
              setHosting(true);
              setErr(null);
              const r = await emit<{ code: string }>("room:create", { settings: { gameSlug: game.slug, modes: modes.length ? modes : undefined } });
              if (r.error) {
                setErr(r.error);
                setHosting(false);
              } else router.push(`/room/${r.code}`);
            }}
          >
            {hosting ? "Creating…" : "🥳 Host a room"}
          </button>
        )}
      </div>
      {err && <p className="text-sm text-bad-400">{err}</p>}
    </div>
  );
}
