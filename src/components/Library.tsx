"use client";
import { useMemo, useRef, useState } from "react";
import type { GameInfo } from "@/engine/registry";
import { GameCard, familyLabel } from "./GameCard";
import { gameFamily } from "./ui/GameGlyph";
import { Icon } from "./ui/Icon";
import { Segmented } from "./ui/Segmented";

const ORDER = ["party", "trivia", "words", "visual", "sports", "cards", "medicine"];

export function Library({ games }: { games: GameInfo[] }) {
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const families = useMemo(() => ORDER.filter((f) => games.some((g) => gameFamily(g.slug, g.group) === f)), [games]);
  const shown = useMemo(
    () =>
      games.filter(
        (g) =>
          (group === "all" || (group === "original" ? g.original : gameFamily(g.slug, g.group) === group)) &&
          (!q || `${g.name} ${g.short}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [games, group, q],
  );
  // Browsing everything reads best in families; a filter or a search is a flat list.
  const sections = group === "all" && !q ? families.map((f) => ({ id: f, title: familyLabel({ slug: "", group: f }), items: shown.filter((g) => gameFamily(g.slug, g.group) === f) })) : [{ id: "flat", title: "", items: shown }];
  return (
    <section id="games" aria-labelledby="library" className="scroll-mt-20">
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="library" className="serif text-[34px] leading-none text-fg">
            Library
          </h2>
          <p className="mt-2 text-sm text-fg-3">
            <span className="num">{games.length}</span> games, <span className="num">{games.filter((g) => g.original).length}</span> of them PartyVerse originals.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Segmented
            value={group}
            onChange={setGroup}
            options={[{ id: "all", label: "All" }, ...families.map((f) => ({ id: f, label: familyLabel({ slug: "", group: f }) })), { id: "original", label: "Originals" }]}
            className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0"
          />
          <label className="relative block sm:w-56">
            <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
            <input ref={search} className="input min-h-9 py-1.5 pl-9 text-sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search games" />
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-12">
        {sections.map(
          (s) =>
            s.items.length > 0 && (
              <div key={s.id + group + q} className="grid gap-x-10 md:grid-cols-[160px_minmax(0,1fr)]">
                {s.title ? (
                  <div className="mb-3 md:mb-0 md:pt-3">
                    <h3 className="text-sm font-semibold text-fg">{s.title}</h3>
                    <span className="num text-sm text-fg-3">{s.items.length}</span>
                  </div>
                ) : (
                  <div className="hidden md:block" />
                )}
                <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                  {s.items.map((g, i) => (
                    <GameCard key={g.slug} g={g} i={i} />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
      {!shown.length && (
        <div className="py-20 text-center">
          <p className="text-fg-2">Nothing matches &ldquo;{q}&rdquo;.</p>
          <button
            className="btn-quiet btn-sm mt-3"
            onClick={() => {
              setQ("");
              setGroup("all");
              search.current?.focus();
            }}
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
