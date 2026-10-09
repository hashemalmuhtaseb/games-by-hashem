import Link from "next/link";
import { catalog, uniqueQuestionCount } from "@/server/catalog";
import { gameConfig } from "@/server/game-config";
import { Library } from "@/components/Library";
import { JoinCode } from "@/components/JoinCode";

export const dynamic = "force-dynamic";

export default async function Home() {
  const games = (await Promise.all(catalog().map(async (g) => ((await gameConfig(g.slug)).enabled ? g : null)))).filter((g) => g !== null);
  const totalQuestions = uniqueQuestionCount(games.map((g) => g.slug));
  const originals = games.filter((g) => g.original).length;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24">
      <section className="relative grid gap-8 py-12 lg:grid-cols-[1.3fr_1fr] lg:py-20">
        <div>
          <span className="chip border-brand-500/40 text-brand-400">✨ {games.length} games · {totalQuestions.toLocaleString()}+ questions · never the same twice</span>
          <h1 className="display mt-5 text-5xl leading-[1.05] font-black text-white sm:text-6xl lg:text-7xl">
            Party games that
            <span className="block bg-gradient-to-r from-brand-400 via-hot-500 to-orange-400 bg-clip-text text-transparent">never repeat.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-300">
            Flags, films, football, rare words and {originals} games you won&apos;t find anywhere else. Play solo, take the daily challenge, or throw a real-time party for up to 12 friends. We remember what you&apos;ve seen so every round feels new.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/play/roulette" className="btn-primary px-6 py-3.5 text-lg">
              ⚡ Quick play
            </Link>
            <Link href="/party" className="btn-ghost px-6 py-3.5 text-lg">
              🥳 Host a party
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Link href="/daily" className="card group relative overflow-hidden p-6 transition hover:border-white/20">
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-400 to-hot-500 opacity-25 blur-3xl transition group-hover:opacity-50" />
            <div className="label text-warn-400">📅 Daily challenge</div>
            <div className="display mt-2 text-2xl font-bold text-white">Same 10 questions for everyone today</div>
            <p className="mt-1 text-sm text-ink-300">One attempt. Mixed topics. Compare with the world.</p>
            <span className="mt-4 inline-block font-semibold text-warn-400 group-hover:translate-x-1 transition">Play today&apos;s →</span>
          </Link>
          <div className="card p-6">
            <div className="label">Got a room code?</div>
            <div className="mt-3">
              <JoinCode />
            </div>
          </div>
        </div>
      </section>
      <Library games={games} />
    </div>
  );
}
