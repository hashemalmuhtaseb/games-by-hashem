"use client";
import Link from "next/link";
import type { PublicProfile } from "@/server/profiles";
import { Avatar } from "./Avatar";

const GAME_NAMES: Record<string, string> = { flags: "🚩 Flags", movies: "🎬 Movies", football: "⚽ Football", "rare-words": "💎 Rare Words", celebrities: "🌟 Celebrities", roulette: "🎰 Roulette", quickfire: "⚡ Quickfire", daily: "📅 Daily", tournament: "🏟️ Tournament" };
export const gameName = (slug: string) => GAME_NAMES[slug] ?? slug.replace(/-/g, " ");

export function ProfileView({ p, children }: { p: PublicProfile; children?: React.ReactNode }) {
  const xpPct = Math.min(100, ((p.xp - p.xpLevelStart) / Math.max(1, p.xpNextLevel - p.xpLevelStart)) * 100);
  const accuracy = p.roundsPlayed ? Math.round((p.correctAnswers / p.roundsPlayed) * 100) : 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row">
        <Avatar avatar={p.avatar} color={p.color} size={96} />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="display text-3xl font-semibold text-fg">{p.displayName}</h1>
          <div className="text-sm text-fg-3">
            {p.username ? `@${p.username}` : "Guest player"} · joined {new Date(p.joined).toLocaleDateString()}
          </div>
          {p.bio && <p className="mt-2 text-fg-2">{p.bio}</p>}
          <div className="mt-3 flex items-center gap-3">
            <span className="display text-lg font-bold text-brand-400">Lv {p.level}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-hot-500" style={{ width: `${xpPct}%` }} />
            </div>
            <span className="text-xs text-fg-3 tabular-nums">
              {p.xp - p.xpLevelStart}/{p.xpNextLevel - p.xpLevelStart} XP
            </span>
          </div>
        </div>
        {children}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Games", p.gamesPlayed],
          ["Wins", p.wins],
          ["Correct", p.correctAnswers],
          ["Accuracy", `${accuracy}%`],
          ["Best streak", `🔥 ${p.bestStreak}`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4 text-center">
            <div className="display text-2xl font-semibold text-fg">{v}</div>
            <div className="text-xs text-fg-3">{k}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="label mb-3">Achievements ({p.achievements.filter((a) => a.unlockedAt).length}/{p.achievements.length})</h2>
          <div className="grid grid-cols-2 gap-2">
            {p.achievements.map((a) => (
              <div key={a.slug} className={`flex items-center gap-3 rounded-xl p-2.5 ${a.unlockedAt ? "bg-warn-400/10" : "bg-white/[0.02] opacity-45"}`} title={a.description}>
                <span className={`text-2xl ${a.unlockedAt ? "" : "grayscale"}`}>{a.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{a.name}</span>
                  <span className="block truncate text-xs text-fg-3">{a.description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="card p-5">
            <h2 className="label mb-3">By game</h2>
            {p.games.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-3">
                  <tr>
                    <th className="pb-2 font-medium">Game</th>
                    <th className="pb-2 text-right font-medium">Plays</th>
                    <th className="pb-2 text-right font-medium">Accuracy</th>
                    <th className="pb-2 text-right font-medium">Best</th>
                  </tr>
                </thead>
                <tbody>
                  {p.games.map((g) => (
                    <tr key={g.slug} className="border-t border-line">
                      <td className="py-1.5 text-fg">
                        <Link href={`/leaderboard?board=game:${g.slug}`} className="hover:underline">
                          {gameName(g.slug)}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{g.plays}</td>
                      <td className="py-1.5 text-right tabular-nums">{g.rounds ? Math.round((g.correct / g.rounds) * 100) : 0}%</td>
                      <td className="py-1.5 text-right font-semibold text-fg tabular-nums">{g.bestScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-fg-3">No games yet.</p>
            )}
            {p.ratings.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.ratings.map((r) => (
                  <span key={r.board} className="chip">
                    🏆 {r.board === "global" ? "Overall" : gameName(r.board)} {r.rating}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="label mb-3">Recent games</h2>
            {p.recent.length ? (
              <ul className="space-y-1.5 text-sm">
                {p.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-fg">{gameName(r.game)}</span>
                    <span className="text-xs text-fg-3">{r.mode.replace(":", " · ")}</span>
                    <span className="flex-1 text-right text-xs text-fg-3">{r.correct}/{r.rounds}{r.mode.startsWith("room") ? ` · #${r.rank}` : ""}</span>
                    <span className="w-14 text-right font-semibold text-fg tabular-nums">{r.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">Nothing yet — go play!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
