"use client";
import Link from "next/link";
import type { PublicProfile } from "@/server/profiles";
import { Avatar } from "./Avatar";
import { GameGlyph } from "./ui/GameGlyph";

const GAME_NAMES: Record<string, string> = { flags: "Flags", movies: "Movies", football: "Football", "rare-words": "Rare Words", celebrities: "Celebrities", roulette: "Roulette", quickfire: "Quickfire", daily: "Daily", tournament: "Tournament" };
export const gameName = (slug: string) => GAME_NAMES[slug] ?? slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ProfileView({ p, children }: { p: PublicProfile; children?: React.ReactNode }) {
  const into = p.xp - p.xpLevelStart;
  const span = Math.max(1, p.xpNextLevel - p.xpLevelStart);
  const xpPct = Math.min(100, (into / span) * 100);
  const accuracy = p.roundsPlayed ? Math.round((p.correctAnswers / p.roundsPlayed) * 100) : 0;
  const unlocked = p.achievements.filter((a) => a.unlockedAt).length;
  const stats: [string, string | number][] = [
    ["Games", p.gamesPlayed],
    ["Wins", p.wins],
    ["Correct", p.correctAnswers.toLocaleString()],
    ["Accuracy", `${accuracy}%`],
    ["Best streak", p.bestStreak],
  ];
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Avatar avatar={p.avatar} color={p.color} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="serif truncate text-[40px] leading-none text-fg sm:text-[48px]">{p.displayName}</h1>
          <div className="mt-2 text-sm text-fg-3">
            {p.username ? `@${p.username}` : "Guest"} · Joined {new Date(p.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          {p.bio && <p className="mt-3 max-w-xl leading-relaxed text-fg-2">{p.bio}</p>}
        </div>
        {children}
      </header>

      <section aria-label="Level">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-fg">
            Level <span className="num">{p.level}</span>
          </span>
          <span className="num text-fg-3">
            {into.toLocaleString()} / {span.toLocaleString()} XP to level {p.level + 1}
          </span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${xpPct}%` }} />
        </div>
      </section>

      <dl className="num grid grid-cols-2 border-y border-line sm:grid-cols-5">
        {stats.map(([k, v], i) => (
          <div key={k} className={`py-5 ${i > 0 ? "sm:border-l sm:border-line sm:pl-6" : ""} ${i % 2 === 1 ? "max-sm:border-l max-sm:border-line max-sm:pl-5" : ""} ${i >= 2 ? "max-sm:border-t max-sm:border-line" : ""} ${i === 4 ? "max-sm:col-span-2" : ""}`}>
            <dd className="display text-[28px] leading-none font-semibold text-fg">{v}</dd>
            <dt className="mt-2 text-[13px] text-fg-3">{k}</dt>
          </div>
        ))}
      </dl>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-12">
          <section aria-labelledby="records">
            <h2 id="records" className="mb-4 text-[15px] font-semibold text-fg">
              Records
            </h2>
            {p.games.length ? (
              <table className="num w-full text-sm">
                <thead className="text-left text-[13px] text-fg-3">
                  <tr className="border-b border-line">
                    <th className="pb-2.5 font-normal">Game</th>
                    <th className="pb-2.5 text-right font-normal">Plays</th>
                    <th className="pb-2.5 text-right font-normal">Accuracy</th>
                    <th className="pb-2.5 text-right font-normal">Best</th>
                  </tr>
                </thead>
                <tbody>
                  {p.games.map((g) => (
                    <tr key={g.slug} className="border-b border-line">
                      <td className="py-2.5">
                        <Link href={`/leaderboard?board=game:${g.slug}`} className="flex items-center gap-2.5 text-fg transition-colors hover:text-accent">
                          <GameGlyph slug={g.slug} size={24} />
                          {gameName(g.slug)}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-fg-2">{g.plays}</td>
                      <td className="py-2.5 text-right text-fg-2">{g.rounds ? Math.round((g.correct / g.rounds) * 100) : 0}%</td>
                      <td className="py-2.5 text-right font-medium text-fg">{g.bestScore.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Records appear after your first game.</Empty>
            )}
            {p.ratings.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-3">
                {p.ratings.map((r) => (
                  <span key={r.board}>
                    {r.board === "global" ? "Overall" : gameName(r.board)} rating <span className="num font-medium text-fg">{r.rating}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-4 text-[15px] font-semibold text-fg">
              Recent games
            </h2>
            {p.recent.length ? (
              <ul className="num text-sm">
                {p.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 border-b border-line py-2.5 first:border-t">
                    <GameGlyph slug={r.game} size={24} />
                    <span className="min-w-0 flex-1 truncate text-fg">
                      {gameName(r.game)} <span className="text-fg-3 capitalize">· {r.mode.replace(":", " · ")}</span>
                    </span>
                    <span className="text-[13px] text-fg-3">
                      {r.correct}/{r.rounds}
                      {r.mode.startsWith("room") ? ` · #${r.rank}` : ""}
                    </span>
                    <span className="w-14 text-right font-medium text-fg">{r.points.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Nothing yet.{" "}
                <Link href="/" className="link">
                  Pick a game
                </Link>
              </Empty>
            )}
          </section>
        </div>

        <section aria-labelledby="achievements">
          <h2 id="achievements" className="mb-4 flex items-baseline justify-between text-[15px] font-semibold text-fg">
            Achievements
            <span className="num text-sm font-normal text-fg-3">
              {unlocked} of {p.achievements.length}
            </span>
          </h2>
          <ul className="flex flex-col">
            {p.achievements.map((a) => (
              <li key={a.slug} className="flex items-center gap-3.5 border-b border-line py-3 first:border-t">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-lg ${a.unlockedAt ? "bg-accent-soft" : "bg-surface-1 opacity-50 grayscale"}`} aria-hidden>
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${a.unlockedAt ? "text-fg" : "text-fg-3"}`}>{a.name}</span>
                  <span className="block truncate text-[13px] text-fg-3">{a.description}</span>
                </span>
                {a.unlockedAt && <span className="num shrink-0 text-xs text-fg-3">{new Date(a.unlockedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-line py-6 text-sm text-fg-3">{children}</p>;
}
