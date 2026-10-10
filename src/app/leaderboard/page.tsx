import Link from "next/link";
import { leaderboard } from "@/server/leaderboard";
import { catalog } from "@/server/catalog";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboards" };

const BOARDS = [
  { id: "daily", label: "📅 Today's daily", unit: "pts" },
  { id: "xp", label: "⭐ Experience", unit: "XP" },
  { id: "wins", label: "🏆 Party wins", unit: "wins" },
  { id: "rating", label: "📈 Ranked rating", unit: "rating" },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const sp = await searchParams;
  const games = catalog();
  const board = sp.board && (BOARDS.some((b) => b.id === sp.board) || /^(game|rating):[a-z-]{2,30}$/.test(sp.board)) ? sp.board : "daily";
  const rows = await leaderboard(board);
  const unit = BOARDS.find((b) => b.id === board)?.unit ?? (board.startsWith("rating:") ? "rating" : "best");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="display text-4xl font-semibold text-fg">Leaderboards</h1>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {BOARDS.map((b) => (
          <Link key={b.id} href={`/leaderboard?board=${b.id}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${board === b.id ? "bg-white text-ink-950" : "bg-surface-2 text-fg-2 hover:text-fg"}`}>
            {b.label}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {games.map((g) => (
          <Link key={g.slug} href={`/leaderboard?board=game:${g.slug}`} className={`rounded-full px-3 py-1 text-xs font-medium ${board === `game:${g.slug}` ? "bg-white text-ink-950" : "bg-surface-1 text-fg-3 hover:text-fg"}`}>
            {g.icon} {g.name}
          </Link>
        ))}
      </div>
      <div className="card mt-6 overflow-hidden">
        {rows.length ? (
          <ol>
            {rows.map((r) => (
              <li key={r.rank + r.player.id} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-0">
                <span className={`display w-8 text-center text-lg font-semibold ${r.rank === 1 ? "text-amber-300" : r.rank === 2 ? "text-slate-300" : r.rank === 3 ? "text-orange-400" : "text-fg-3"}`}>{r.rank}</span>
                <Avatar avatar={r.player.avatar} color={r.player.color} size={36} />
                <Link href={`/u/${r.player.id}`} className="flex-1 font-semibold text-fg hover:underline">
                  {r.player.displayName}
                  {r.player.isGuest && <span className="ml-2 text-xs font-normal text-fg-3">guest</span>}
                </Link>
                <span className="hidden text-sm text-fg-3 sm:block">{r.detail}</span>
                <span className="display w-24 text-right text-lg font-bold text-fg tabular-nums">
                  {r.value.toLocaleString()} <span className="text-xs font-normal text-fg-3">{unit}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-12 text-center text-fg-3">Nobody on this board yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}
