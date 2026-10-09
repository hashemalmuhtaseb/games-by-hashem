"use client";
import { useMemo, useState } from "react";
import type { GameInfo } from "@/engine/registry";
import { GameCard } from "./GameCard";

const GROUPS = [
  { id: "all", label: "All games" },
  { id: "party", label: "🎉 Party" },
  { id: "trivia", label: "🧠 Trivia" },
  { id: "visual", label: "👁️ Visual" },
  { id: "words", label: "🔤 Words" },
  { id: "sports", label: "⚽ Sports" },
  { id: "original", label: "✨ Originals" },
];

export function Library({ games }: { games: GameInfo[] }) {
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const shown = useMemo(
    () =>
      games.filter(
        (g) =>
          (group === "all" || (group === "original" ? g.original : g.group === group)) &&
          (!q || `${g.name} ${g.short}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [games, group, q],
  );
  return (
    <section id="games" className="scroll-mt-20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button key={g.id} onClick={() => setGroup(g.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${group === g.id ? "bg-white text-ink-950" : "bg-white/[0.05] text-ink-300 hover:bg-white/10 hover:text-white"}`}>
              {g.label}
            </button>
          ))}
        </div>
        <input className="input max-w-xs py-2" placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((g, i) => (
          <GameCard key={g.slug} g={g} i={i} />
        ))}
      </div>
      {!shown.length && <p className="py-12 text-center text-ink-400">No games match that search.</p>}
    </section>
  );
}
