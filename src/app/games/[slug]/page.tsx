import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { catalog } from "@/server/catalog";
import { gameConfig } from "@/server/game-config";
import { Launcher } from "./Launcher";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = catalog().find((x) => x.slug === slug);
  return { title: g?.name ?? "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = catalog().find((x) => x.slug === slug);
  if (!g || !(await gameConfig(slug)).enabled) notFound();
  if (g.href) redirect(g.href);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] p-8 sm:p-10" style={{ background: `linear-gradient(135deg, ${g.accent[0]}22, ${g.accent[1]}11 60%, transparent)` }}>
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: `linear-gradient(135deg, ${g.accent[0]}, ${g.accent[1]})` }} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-ink-900/60 text-6xl shadow-2xl ring-1 ring-white/10">{g.icon}</span>
          <div>
            <h1 className="display text-4xl font-black text-white sm:text-5xl">{g.name}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-300">{g.short}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{g.rounds} rounds</span>
              <span className="chip">~{g.timeLimitSec}s per round</span>
              <span className="chip">{g.questionCount.toLocaleString()} questions</span>
              {g.multiplayer && !g.soloOnly ? <span className="chip">👥 2–12 players</span> : <span className="chip">👤 Solo</span>}
              {g.original && <span className="chip border-brand-500/40 text-brand-400">PartyVerse original</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="card p-6">
          <h2 className="label mb-3">How to play</h2>
          <ul className="space-y-2.5">
            {g.rules.map((r, i) => (
              <li key={i} className="flex gap-3 text-ink-100">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/25 text-xs font-bold text-brand-400">{i + 1}</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <Launcher game={g} />
      </div>
    </div>
  );
}
