import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { catalog } from "@/server/catalog";
import { gameConfig } from "@/server/game-config";
import { familyLabel } from "@/components/GameCard";
import { GameGlyph, toneOf } from "@/components/ui/GameGlyph";
import { Icon } from "@/components/ui/Icon";
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
  const tone = toneOf(g.slug, g.group);
  const facts = [
    `${g.rounds} rounds`,
    `${g.timeLimitSec}s a round`,
    `${g.questionCount.toLocaleString()} questions`,
    g.multiplayer && !g.soloOnly ? "Solo or 2–12 players" : "Solo",
  ];
  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 pb-24 sm:px-8 sm:pt-8">
      <Link href="/#games" className="btn-quiet btn-sm -ml-3 text-fg-3">
        <Icon name="arrow-left" size={16} />
        Library
      </Link>

      <header className="animate-rise mt-8 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-8">
        <GameGlyph slug={g.slug} group={g.group} name={g.name} size={88} />
        <div>
          <div className="overline" style={{ color: tone }}>
            {familyLabel(g)}
            {g.original ? " · PartyVerse original" : ""}
          </div>
          <h1 className="serif mt-3 text-[44px] leading-[1.02] text-fg sm:text-[56px]">{g.name}</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-fg-2">{g.short}</p>
        </div>
      </header>

      <ul className="num mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-4 text-sm text-fg-2">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-16">
        <section aria-labelledby="how" className="animate-rise [animation-delay:60ms]">
          <h2 id="how" className="text-[15px] font-semibold text-fg">
            How it plays
          </h2>
          <ol className="mt-5 flex flex-col">
            {g.rules.map((r, i) => (
              <li key={i} className="flex gap-4 border-t border-line py-4 first:border-t-0 first:pt-0">
                <span className="num w-5 shrink-0 pt-px font-mono text-xs text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="leading-relaxed text-fg-2">{r}</span>
              </li>
            ))}
          </ol>
        </section>
        <Launcher game={g} />
      </div>
    </div>
  );
}
