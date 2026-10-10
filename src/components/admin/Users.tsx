"use client";

import { useState } from "react";
import { api } from "@/client/api";
import { useAdmin, qs, ago } from "./useAdmin";

interface U { id: string; username: string; role: "USER" | "MODERATOR" | "ADMIN"; bannedAt: string | null; createdAt: string; player: { id: string; avatar: string; color: string; lastSeenAt: string; profile: { level: number; gamesPlayed: number; wins: number } | null } | null }

export function Users({ canEdit }: { canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [banned, setBanned] = useState(false);
  const { data, error, reload } = useAdmin<{ users: U[] }>(`/api/admin/users${qs({ q: search, banned: banned ? "1" : "" })}`);
  const [msg, setMsg] = useState<string | null>(null);
  async function patch(userId: string, body: object, done: string) {
    try {
      await api("/api/admin/users", { method: "PATCH", body: { userId, ...body } });
      setMsg(done);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
          <input className="input w-60 py-2" placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost">Search</button>
        </form>
        <label className="chip cursor-pointer"><input type="checkbox" checked={banned} onChange={(e) => setBanned(e.target.checked)} /> banned only</label>
        {!canEdit && <span className="text-fg-3 text-xs">Read-only: only admins can ban or change roles.</span>}
      </div>
      {msg && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{msg}</p>}
      {error && <p className="text-bad-400">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-fg-3 text-left text-xs uppercase">
            <tr><th className="p-3">User</th><th>Role</th><th>Level</th><th>Games</th><th>Last seen</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="p-3">
                  <a className="hover:underline" href={u.player ? `/u/${u.player.id}` : undefined}>{u.player?.avatar} {u.username}</a>
                  {u.bannedAt && <span className="text-bad-400 ml-2 text-xs font-bold">BANNED</span>}
                </td>
                <td>
                  {canEdit ? (
                    <select className="input w-auto py-1 text-xs" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value }, `${u.username} is now ${e.target.value.toLowerCase()}.`)}>
                      {["USER", "MODERATOR", "ADMIN"].map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}
                    </select>
                  ) : (
                    u.role.toLowerCase()
                  )}
                </td>
                <td>{u.player?.profile?.level ?? 1}</td>
                <td>{u.player?.profile?.gamesPlayed ?? 0}</td>
                <td className="text-fg-2">{u.player ? ago(u.player.lastSeenAt) : "—"}</td>
                <td className="text-fg-2">{ago(u.createdAt)}</td>
                <td className="pr-3 text-right">
                  {canEdit && (u.bannedAt ? (
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patch(u.id, { ban: false }, `${u.username} unbanned.`)}>Unban</button>
                  ) : (
                    <button className="btn-danger px-3 py-1 text-xs" onClick={() => confirm(`Ban ${u.username}? They are signed out everywhere immediately.`) && patch(u.id, { ban: true }, `${u.username} banned and signed out.`)}>Ban</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.users.length === 0 && <p className="text-fg-2 p-5 text-center text-sm">No accounts match.</p>}
      </div>
    </div>
  );
}
