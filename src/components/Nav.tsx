"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/client/me";
import { isMuted, setMuted } from "@/client/sound";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./ui/Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Games", icon: "play" },
  { href: "/daily", label: "Daily", icon: "calendar" },
  { href: "/party", label: "Party", icon: "users" },
  { href: "/leaderboard", label: "Leaderboards", icon: "chart" },
];

function isActive(href: string, path: string | null) {
  if (!path) return false;
  return href === "/" ? path === "/" || path.startsWith("/games") : path.startsWith(href);
}

export function Wordmark() {
  return (
    <span className="serif flex items-baseline text-[22px] leading-none text-fg">
      PartyVerse
      <span className="ml-[3px] inline-block h-[6px] w-[6px] rounded-full bg-accent" />
    </span>
  );
}

export function Nav() {
  const { me, user } = useMe();
  const path = usePathname();
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  if (path?.startsWith("/play/") || path?.startsWith("/room/") || path === "/daily") return null; // immersive screens draw their own header
  const staff = user && (user.role === "ADMIN" || user.role === "MODERATOR");
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5 sm:px-8">
          <Link href="/" className="-mx-1 rounded-md px-1" aria-label="PartyVerse home">
            <Wordmark />
          </Link>
          <div className="hidden flex-1 items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const on = isActive(l.href, path);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${on ? "text-fg" : "text-fg-3 hover:text-fg"}`}
                >
                  {l.label}
                  {on && <span className="absolute inset-x-3 -bottom-[11px] h-px bg-fg" />}
                </Link>
              );
            })}
            {staff && (
              <Link href="/admin" className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${path?.startsWith("/admin") ? "text-fg" : "text-fg-3 hover:text-fg"}`}>
                Admin
              </Link>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
              aria-pressed={muted}
              className="btn-icon h-9 min-h-9 w-9"
              onClick={() => {
                setMuted(!muted);
                setM(!muted);
              }}
            >
              <Icon name={muted ? "volume-off" : "volume"} size={18} />
            </button>
            {me ? (
              <Link href="/profile" className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 transition-colors hover:bg-surface-2 md:pr-3">
                <Avatar avatar={me.avatar} color={me.color} size={28} />
                <span className="hidden text-sm leading-tight md:block">
                  <span className="block font-medium text-fg">{me.displayName}</span>
                </span>
                <span className="num hidden text-xs text-fg-3 md:block">Lv {me.level}</span>
              </Link>
            ) : (
              <span className="skeleton h-7 w-7 rounded-full" />
            )}
          </div>
        </nav>
      </header>

      {/* Phone: a native-style tab bar within thumb reach. */}
      <nav className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Primary">
        <div className="grid h-16 grid-cols-4">
          {LINKS.map((l) => {
            const on = isActive(l.href, path);
            return (
              <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${on ? "text-fg" : "text-fg-3"}`}>
                <Icon name={l.icon} size={22} strokeWidth={on ? 2 : 1.6} />
                {l.label === "Leaderboards" ? "Ranks" : l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
