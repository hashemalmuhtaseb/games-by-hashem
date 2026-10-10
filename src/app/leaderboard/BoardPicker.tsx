"use client";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

/** Thirty game boards fit better in one menu than in thirty pills. */
export function BoardPicker({ games, value }: { games: { slug: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <label className="relative block sm:w-56">
      <span className="sr-only">Board for a single game</span>
      <select
        className={`input min-h-9 appearance-none py-1.5 pr-8 text-sm ${value ? "text-fg shadow-[inset_0_0_0_1px_var(--color-accent-line)]" : "text-fg-2"}`}
        value={value}
        onChange={(e) => router.push(e.target.value ? `/leaderboard?board=game:${e.target.value}` : "/leaderboard?board=daily")}
      >
        <option value="">By game</option>
        {games.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={15} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-3" />
    </label>
  );
}
