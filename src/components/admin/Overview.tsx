"use client";

import { useEffect } from "react";
import { useAdmin, ago } from "./useAdmin";

interface Data {
  players: number;
  accounts: number;
  active24: number;
  active7: number;
  gamesStarted24: number;
  rounds24: number;
  openReports: number;
  openUserReports: number;
  pending: number;
  retired: number;
  questions: number;
  live: { rooms: number; playing: number; players: number; list: { code: string; game: string; mode: string; phase: string; players: number; private: boolean; createdAt: number }[] };
  perGame: { slug: string; name: string; icon: string; plays: number }[];
  daily: { day: string; plays: number }[];
}

function Stat({ label, value, hint, onClick, tone }: { label: string; value: number | string; hint?: string; onClick?: () => void; tone?: "warn" | "bad" }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`card p-4 text-left ${onClick ? "transition hover:bg-white/[0.06]" : ""}`}>
      <div className="label">{label}</div>
      <div className={`display mt-1 text-3xl font-bold ${tone === "warn" ? "text-warn-400" : tone === "bad" ? "text-bad-400" : ""}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      {hint && <div className="text-ink-400 mt-1 text-xs">{hint}</div>}
    </Comp>
  );
}

export function Overview({ onOpen }: { onOpen: (tab: string) => void }) {
  const { data, error, reload } = useAdmin<Data>("/api/admin/overview");
  useEffect(() => {
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);
  if (error) return <p className="text-bad-400">{error}</p>;
  if (!data) return <p className="text-ink-300">Loading…</p>;
  const max = Math.max(1, ...data.daily.map((d) => d.plays));
  const maxGame = Math.max(1, ...data.perGame.map((g) => g.plays));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Live players" value={data.live.players} hint={`${data.live.rooms} rooms · ${data.live.playing} mid-game`} />
        <Stat label="Active 24h" value={data.active24} hint={`${data.active7.toLocaleString()} in 7 days`} />
        <Stat label="Games started 24h" value={data.gamesStarted24} hint={`${data.rounds24.toLocaleString()} questions served`} />
        <Stat label="Players" value={data.players} hint={`${data.accounts.toLocaleString()} with accounts`} />
        <Stat label="Review queue" value={data.pending} tone={data.pending ? "warn" : undefined} onClick={() => onOpen("review")} hint="Drafts waiting for a human" />
        <Stat label="Open reports" value={data.openReports + data.openUserReports} tone={data.openReports + data.openUserReports ? "bad" : undefined} onClick={() => onOpen("reports")} hint={`${data.openReports} content · ${data.openUserReports} players`} />
        <Stat label="Questions in rotation" value={data.questions} hint="Unique published questions" />
        <Stat label="Retired" value={data.retired} hint="Never served again" onClick={() => onOpen("questions")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Games started, last 14 days</h2>
          {data.daily.length === 0 ? (
            <p className="text-ink-400 text-sm">No games yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {data.daily.map((d) => (
                <div key={d.day} className="group flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.plays}`}>
                  <span className="text-ink-400 text-[10px] opacity-0 group-hover:opacity-100">{d.plays}</span>
                  <div className="from-brand-500 to-hot-500 w-full rounded-t-md bg-gradient-to-t" style={{ height: `${(d.plays / max) * 120 + 4}px` }} />
                  <span className="text-ink-400 text-[10px]">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Most played, last 7 days</h2>
          <ul className="space-y-1.5">
            {data.perGame.slice(0, 8).map((g) => (
              <li key={g.slug} className="flex items-center gap-2 text-sm">
                <span className="w-6">{g.icon}</span>
                <span className="w-40 truncate">{g.name}</span>
                <div className="h-2 flex-1 rounded-full bg-white/5">
                  <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${(g.plays / maxGame) * 100}%` }} />
                </div>
                <span className="text-ink-300 w-10 text-right tabular-nums">{g.plays}</span>
              </li>
            ))}
            {data.perGame.length === 0 && <li className="text-ink-400 text-sm">No plays yet.</li>}
          </ul>
        </section>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Live rooms</h2>
        {data.live.list.length === 0 ? (
          <p className="text-ink-400 text-sm">No rooms open right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-400 text-left text-xs uppercase">
                <tr><th className="py-1">Code</th><th>Game</th><th>Mode</th><th>Phase</th><th>Players</th><th>Opened</th></tr>
              </thead>
              <tbody>
                {data.live.list.map((r) => (
                  <tr key={r.code} className="border-t border-white/5">
                    <td className="py-1.5 font-mono">{r.code}{r.private && " 🔒"}</td>
                    <td>{r.game}</td>
                    <td>{r.mode}</td>
                    <td>{r.phase}</td>
                    <td>{r.players}</td>
                    <td className="text-ink-400">{ago(new Date(r.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
