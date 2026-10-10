import Link from "next/link";
import { leaderboard } from "@/server/leaderboard";
import { catalog } from "@/server/catalog";
import { Avatar } from "@/components/Avatar";
import { GameGlyph } from "@/components/ui/GameGlyph";
import { BoardPicker } from "./BoardPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboards" };

const BOARDS = [
  { id: "daily", label: "Today", unit: "pts", blurb: "Today's daily challenge. Resets at midnight UTC." },
  { id: "xp", label: "Experience", unit: "XP", blurb: "Everything you've ever played, added up." },
  { id: "wins", label: "Party wins", unit: "wins", blurb: "Multiplayer games won." },
  { id: "rating", label: "Ranked", unit: "", blurb: "Overall rating from ranked games." },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const sp = await searchParams;
  const games = catalog();
  const board = sp.board && (BOARDS.some((b) => b.id === sp.board) || /^(game|rating):[a-z-]{2,30}$/.test(sp.board)) ? sp.board : "daily";
  const rows = await leaderboard(board);
  const known = BOARDS.find((b) => b.id === board);
  const gameSlug = board.includes(":") ? board.split(":")[1] : null;
  const game = gameSlug ? games.find((g) => g.slug === gameSlug) : null;
  const unit = known?.unit ?? (board.startsWith("rating:") ? "" : "best");
  const blurb = known?.blurb ?? (game ? `Best single-game scores in ${game.name}.` : "");
  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
      <h1 className="serif text-[44px] leading-none text-fg sm:text-[52px]">Leaderboards</h1>

      <div className="mt-8 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Boards" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="inline-flex rounded-[10px] bg-surface-1 p-[3px] shadow-[inset_0_0_0_1px_var(--color-line)]">
            {BOARDS.map((b) => {
              const on = board === b.id;
              return (
                <Link
                  key={b.id}
                  href={`/leaderboard?board=${b.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`rounded-[7px] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${on ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-fg-3 hover:text-fg-2"}`}
                >
                  {b.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <BoardPicker games={games.map((g) => ({ slug: g.slug, name: g.name }))} value={gameSlug && board.startsWith("game:") ? gameSlug : ""} />
      </div>

      <div className="mt-6 flex items-center gap-3">
        {game && <GameGlyph slug={game.slug} group={game.group} name={game.name} size={32} />}
        <p className="text-sm text-fg-3">{blurb}</p>
      </div>

      {rows.length ? (
        <ol className="num mt-6">
          {rows.map((r) => (
            <li key={r.rank + r.player.id} className="flex items-center gap-4 border-b border-line py-3 first:border-t">
              <span className={`w-7 text-right font-mono text-sm ${r.rank === 1 ? "text-accent" : r.rank <= 3 ? "text-fg" : "text-fg-3"}`}>{r.rank}</span>
              <Avatar avatar={r.player.avatar} color={r.player.color} size={34} ring={r.rank === 1} />
              <span className="min-w-0 flex-1">
                <Link href={`/u/${r.player.id}`} className="block truncate font-medium text-fg transition-colors hover:text-accent">
                  {r.player.displayName}
                  {r.player.isGuest && <span className="ml-2 text-xs font-normal text-fg-3">Guest</span>}
                </Link>
                {r.detail && <span className="block truncate text-[13px] text-fg-3 sm:hidden">{r.detail}</span>}
              </span>
              <span className="hidden text-[13px] text-fg-3 sm:block">{r.detail}</span>
              <span className="w-28 text-right">
                <span className={`display text-[17px] font-semibold ${r.rank === 1 ? "text-fg" : "text-fg"}`}>{r.value.toLocaleString()}</span>
                {unit && <span className="ml-1.5 text-xs text-fg-3">{unit}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 border-y border-line py-16 text-center">
          <p className="text-fg-2">No one is on this board yet.</p>
          <Link href={board === "daily" ? "/daily" : game ? `/games/${game.slug}` : "/"} className="btn-ghost btn-sm mt-4">
            {board === "daily" ? "Play today's ten" : "Play a game"}
          </Link>
        </div>
      )}
    </div>
  );
}
