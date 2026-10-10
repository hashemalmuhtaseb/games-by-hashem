"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GameInfo } from "@/engine/registry";
import { emit } from "@/client/socket";
import { Icon } from "@/components/ui/Icon";

const VARIANTS = [
  { id: "classic", label: "Classic", desc: "A standard game. Difficulty adapts to you." },
  { id: "survival", label: "Survival", desc: "Three lives, harder every round. How far can you go?" },
  { id: "ranked", label: "Ranked", desc: "Ten standard rounds that move your rating." },
  { id: "chaos", label: "Chaos", desc: "Double points, half time, jackpots and mystery rounds." },
] as const;

export function Launcher({ game }: { game: GameInfo }) {
  const router = useRouter();
  const available = game.modes.filter((m) => m.available);
  const unavailable = game.modes.filter((m) => !m.available);
  const [modes, setModes] = useState<string[]>([]);
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]["id"]>("classic");
  const [hosting, setHosting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setModes((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const qs = () => {
    const p = new URLSearchParams({ variant });
    if (modes.length && variant !== "ranked") p.set("modes", modes.join(","));
    return p.toString();
  };
  const party = game.multiplayer && !game.soloOnly;
  return (
    <section aria-label="Start a game" className="card animate-rise flex flex-col [animation-delay:100ms]">
      {available.length > 1 && (
        <div className="p-6 pb-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-fg">Modes</h2>
            <span className="text-sm text-fg-3">
              {modes.length ? (
                <button className="link text-fg-2" onClick={() => setModes([])}>
                  {modes.length} selected · clear
                </button>
              ) : (
                "All mixed"
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {available.map((m) => (
              <button key={m.id} title={m.description} aria-pressed={modes.includes(m.id)} onClick={() => toggle(m.id)} className="option rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium">
                {m.label}
              </button>
            ))}
          </div>
          {unavailable.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-fg-3">
              {unavailable.map((m) => m.label).join(", ")} {unavailable.length === 1 ? "needs" : "need"} a licensed media source, so {unavailable.length === 1 ? "it is" : "they are"} switched off rather than faked.
            </p>
          )}
        </div>
      )}

      <div className={`p-6 ${available.length > 1 ? "border-t border-line" : ""}`}>
        <h2 className="mb-3 text-[15px] font-semibold text-fg">Solo</h2>
        <div role="radiogroup" aria-label="Solo variant" className="grid gap-1.5 sm:grid-cols-2">
          {VARIANTS.map((v) => {
            const on = variant === v.id;
            return (
              <button key={v.id} role="radio" aria-checked={on} onClick={() => setVariant(v.id)} className="option flex gap-3 p-3.5">
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors ${on ? "bg-accent" : "shadow-[inset_0_0_0_1.5px_var(--color-fg-4)]"}`}>
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" />}
                </span>
                <span>
                  <span className="block font-semibold text-fg">{v.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-fg-3">{v.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-line p-6 sm:flex-row">
        <button
          className="btn-primary btn-lg flex-1"
          disabled={starting}
          onClick={() => {
            setStarting(true);
            router.push(`/play/${game.slug}?${qs()}`);
          }}
        >
          <Icon name="play" size={15} />
          {starting ? "Starting…" : "Play solo"}
        </button>
        {party && (
          <button
            className="btn-ghost btn-lg flex-1"
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
            <Icon name="users" size={17} />
            {hosting ? "Creating room…" : "Host a room"}
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="px-6 pb-5 text-sm text-bad-400">
          {err}
        </p>
      )}
    </section>
  );
}
