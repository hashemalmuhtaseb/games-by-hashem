import Link from "next/link";
import { catalog, uniqueQuestionCount } from "@/server/catalog";
import { gameConfig } from "@/server/game-config";
import { Library } from "@/components/Library";
import { JoinCode } from "@/components/JoinCode";
import { FeaturedGame } from "@/components/GameCard";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

/** Flagship games, rotated daily so the front page is never the same two days running. */
const SPOTLIGHT = ["rare-words", "flags", "football", "connections", "map-mystery", "who-am-i", "higher-lower", "risk-reward", "movies", "closest-wins", "songs", "word-chain"];

export default async function Home() {
  const games = (await Promise.all(catalog().map(async (g) => ((await gameConfig(g.slug)).enabled ? g : null)))).filter((g) => g !== null);
  const totalQuestions = uniqueQuestionCount(games.map((g) => g.slug));
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const pool = SPOTLIGHT.map((s) => games.find((g) => g.slug === s)).filter((g) => g !== undefined);
  const featured = pool.length ? [0, 1, 2].map((i) => pool[(day * 3 + i) % pool.length]).filter((g, i, a) => a.indexOf(g) === i) : [];
  const dailyNo = day - Math.floor(Date.UTC(2026, 0, 1) / 86_400_000) + 1;
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      {/* Masthead */}
      <section className="grid gap-10 pt-12 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:gap-16 lg:pt-20 lg:pb-20">
        <div className="animate-rise">
          <div className="overline">{dateLabel}</div>
          <h1 className="serif mt-5 text-[44px] leading-[1.02] text-fg sm:text-[60px] lg:text-[68px]">
            {games.length} games.
            <br />
            <span className="text-fg-3 italic">
              Never the same <br className="hidden sm:block" />
              question twice.
            </span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-fg-2">
            Flags, film, football and words, plus originals you won&apos;t find anywhere else. PartyVerse remembers what you&apos;ve seen across {totalQuestions.toLocaleString()} questions, so every round is new.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/play/roulette" className="btn-primary btn-lg">
              <Icon name="play" size={16} />
              Quick play
            </Link>
            <Link href="/party" className="btn-ghost btn-lg">
              Host a party
            </Link>
          </div>
        </div>

        <aside className="card animate-rise overflow-hidden [animation-delay:60ms]">
          <Link href="/daily" className="group block p-6 transition-colors hover:bg-surface-2">
            <div className="flex items-center justify-between">
              <span className="overline text-accent">Daily · No. {dailyNo}</span>
              <Icon name="arrow-right" size={18} className="text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />
            </div>
            <div className="mt-4 text-xl font-semibold tracking-tight text-fg">Today&apos;s ten</div>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-2">The same ten questions for everyone, across every topic. One attempt, then see where you stand.</p>
          </Link>
          <div className="border-t border-line p-6">
            <div className="label mb-3">Join a room</div>
            <JoinCode />
          </div>
        </aside>
      </section>

      {/* Spotlight */}
      {featured.length > 0 && (
        <section aria-labelledby="spotlight" className="mb-20">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 id="spotlight" className="text-[15px] font-semibold text-fg">
              Today&apos;s picks
            </h2>
            <span className="text-sm text-fg-3">Changes every day</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
            {featured.map((g, i) => (
              <FeaturedGame key={g.slug} g={g} large={i === 0} className={i === 0 ? "lg:row-span-2" : ""} delay={120 + i * 50} />
            ))}
          </div>
        </section>
      )}

      <Library games={games} />
    </div>
  );
}
