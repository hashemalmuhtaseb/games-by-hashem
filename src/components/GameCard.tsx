import Link from "next/link";
import type { CSSProperties } from "react";
import type { GameInfo } from "@/engine/registry";
import { GameGlyph, gameFamily, toneOf } from "./ui/GameGlyph";
import { Icon } from "./ui/Icon";

const FAMILY_LABEL: Record<string, string> = { party: "Party", trivia: "Trivia", visual: "Visual", words: "Words", sports: "Sports", cards: "Cards", medicine: "Medicine" };

export function familyLabel(g: Pick<GameInfo, "slug" | "group">) {
  return FAMILY_LABEL[gameFamily(g.slug, g.group)] ?? "Trivia";
}

function meta(g: GameInfo) {
  const modes = g.modes.filter((m) => m.available).length;
  return `${modes} ${modes === 1 ? "mode" : "modes"} · ${g.questionCount.toLocaleString()} questions`;
}

/** Editorial spotlight tile for the home page. */
export function FeaturedGame({ g, large, className, delay = 0 }: { g: GameInfo; large?: boolean; className?: string; delay?: number }) {
  const tone = toneOf(g.slug, g.group);
  const style = { "--tone": tone, animationDelay: `${delay}ms` } as CSSProperties;
  return (
    <Link
      href={`/games/${g.slug}`}
      style={style}
      className={`group card animate-rise relative flex flex-col overflow-hidden p-6 transition-colors duration-200 hover:bg-surface-2 ${large ? "min-h-[300px] sm:p-8 lg:min-h-[380px]" : "min-h-[180px]"} ${className ?? ""}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklab,var(--tone)_6%,transparent)]" />
      <div className="relative flex items-start justify-between">
        <GameGlyph slug={g.slug} group={g.group} name={g.name} size={large ? 56 : 44} />
        <span className="overline" style={{ color: tone }}>
          {familyLabel(g)}
          {g.original ? " · Original" : ""}
        </span>
      </div>
      <div className="relative mt-auto pt-8">
        <h3 className={large ? "serif text-[34px] leading-[1.05] text-fg sm:text-[40px]" : "text-lg font-semibold tracking-tight text-fg"}>{g.name}</h3>
        <p className={`mt-2 max-w-md leading-relaxed text-fg-2 ${large ? "text-base" : "line-clamp-2 text-sm"}`}>{g.short}</p>
        {large && (
          <ul className="mt-6 flex flex-wrap gap-1.5">
            {g.modes
              .filter((m) => m.available)
              .slice(0, 6)
              .map((m) => (
                <li key={m.id} className="chip bg-[color-mix(in_oklab,var(--tone)_9%,var(--color-surface-2))] text-fg-2">
                  {m.label}
                </li>
              ))}
          </ul>
        )}
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="num text-fg-3">{meta(g)}</span>
          <span className="flex items-center gap-1.5 font-medium text-fg-2 transition-colors group-hover:text-fg">
            Play
            <Icon name="arrow-right" size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Library entry: a calm row that reads like an index, not a wall of cards. */
export function GameCard({ g, i = 0 }: { g: GameInfo; i?: number }) {
  return (
    <Link
      href={`/games/${g.slug}`}
      style={{ animationDelay: `${Math.min(i, 10) * 18}ms` }}
      className="group animate-rise -mx-3 flex items-center gap-4 rounded-[var(--radius-md)] px-3 py-3 transition-colors duration-150 hover:bg-surface-1"
    >
      <GameGlyph slug={g.slug} group={g.group} name={g.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-semibold tracking-tight text-fg">{g.name}</span>
          {g.original && <span className="text-xs text-fg-3">Original</span>}
          {g.soloOnly && <span className="text-xs text-fg-3">Solo</span>}
        </span>
        <span className="mt-0.5 block truncate text-sm text-fg-3">{g.short}</span>
      </span>
      <Icon name="chevron-right" size={16} className="text-fg-4 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-fg-2" />
    </Link>
  );
}
