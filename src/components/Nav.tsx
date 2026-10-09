"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/client/me";
import { isMuted, setMuted } from "@/client/sound";
import { Avatar } from "./Avatar";

const LINKS: { href: string; label: string; short?: string }[] = [
  { href: "/", label: "Games" },
  { href: "/daily", label: "Daily" },
  { href: "/party", label: "Party" },
  { href: "/leaderboard", label: "Leaderboards", short: "Ranks" },
];

export function Nav() {
  const { me, user } = useMe();
  const path = usePathname();
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  if (path?.startsWith("/play/") || path?.startsWith("/room/")) return null; // immersive screens draw their own header
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4 sm:gap-6">
        <Link href="/" className="display flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-hot-500 text-base shadow-lg shadow-brand-500/30">🎲</span>
          <span className="hidden sm:inline">PartyVerse</span>
        </Link>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path?.startsWith("/games") : path?.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`rounded-lg px-2 py-1.5 text-sm font-medium whitespace-nowrap transition sm:px-3 ${active ? "bg-white/10 text-white" : "text-ink-300 hover:text-white"}`}>
                {l.short ? (
                  <>
                    <span className="sm:hidden">{l.short}</span>
                    <span className="hidden sm:inline">{l.label}</span>
                  </>
                ) : (
                  l.label
                )}
              </Link>
            );
          })}
          {user && (user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Link href="/admin" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${path?.startsWith("/admin") ? "bg-white/10 text-white" : "text-warn-400 hover:text-white"}`}>
              Admin
            </Link>
          )}
        </div>
        <button
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-white sm:p-2"
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {me ? (
          <Link href="/profile" className="flex items-center gap-2 rounded-xl py-1 pr-3 pl-1 hover:bg-white/5">
            <Avatar avatar={me.avatar} color={me.color} size={32} />
            <span className="hidden text-sm leading-tight md:block">
              <span className="block font-semibold">{me.displayName}</span>
              <span className="block text-xs text-ink-400">Lv {me.level}{me.isGuest ? " · guest" : ""}</span>
            </span>
          </Link>
        ) : (
          <span className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        )}
      </nav>
    </header>
  );
}
