"use client";

import { useState } from "react";
import { api } from "@/client/api";
import { useAdmin, qs, ago } from "./useAdmin";

interface PlayerLite { id: string; displayName: string; avatar: string; user: { username: string; bannedAt: string | null } | null }
interface Data {
  content: { id: string; contentKey: string; reason: string; playerId: string; createdAt: string; question: { id: string; status: string; gameSlug: string; topic: string; reportCount: number; prompt: { question?: string; correct?: string } } | null }[];
  users: { id: string; reporterPlayerId: string; targetPlayerId: string; reason: string; context: string | null; createdAt: string }[];
  players: PlayerLite[];
}

export function Reports() {
  const [status, setStatus] = useState("OPEN");
  const { data, error, reload } = useAdmin<Data>(`/api/admin/reports${qs({ status })}`);
  const [msg, setMsg] = useState<string | null>(null);
  const who = (id: string) => data?.players.find((p) => p.id === id);
  const name = (id: string) => {
    const p = who(id);
    return p ? `${p.avatar} ${p.user?.username ?? p.displayName}${p.user ? "" : " (guest)"}` : "unknown";
  };
  async function act(kind: "content" | "user", id: string, action: "resolve" | "dismiss" | "retire") {
    try {
      await api("/api/admin/reports", { method: "PATCH", body: { kind, id, action } });
      setMsg(action === "retire" ? "Question retired; it will not be served again." : `Report ${action === "dismiss" ? "dismissed" : "resolved"}.`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {["OPEN", "RESOLVED", "DISMISSED"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`chip ${status === s ? "bg-surface-3 text-fg" : ""}`}>{s.toLowerCase()}</button>
        ))}
        <span className="text-fg-3 ml-auto text-xs">A question reported by three different players is hidden automatically until you decide.</span>
      </div>
      {msg && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{msg}</p>}
      {error && <p className="text-bad-400">{error}</p>}
      <section>
        <h2 className="mb-2 font-semibold">Content reports</h2>
        <ul className="space-y-2">
          {data?.content.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-fg-3 flex flex-wrap gap-x-3 text-xs">
                  <span className="font-mono">{r.contentKey}</span>
                  {r.question && <span>{r.question.gameSlug} · {r.question.topic}</span>}
                  {r.question && <span className="text-bad-400">🚩 {r.question.reportCount}</span>}
                  {r.question && <span>{r.question.status.toLowerCase()}</span>}
                  <span>{ago(r.createdAt)} by {name(r.playerId)}</span>
                </div>
                <p className="mt-1.5">“{r.reason}”</p>
                {r.question?.prompt.question && <p className="text-fg-2 mt-1 text-sm">Q: {r.question.prompt.question} — ✓ {r.question.prompt.correct}</p>}
              </div>
              {status === "OPEN" && (
                <div className="flex gap-1.5">
                  <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => act("content", r.id, "retire")}>Retire question</button>
                  <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => act("content", r.id, "resolve")}>Fixed</button>
                  <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => act("content", r.id, "dismiss")}>Dismiss</button>
                </div>
              )}
            </li>
          ))}
          {data && data.content.length === 0 && <li className="card text-fg-2 p-5 text-center text-sm">No {status.toLowerCase()} content reports.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Player reports</h2>
        <ul className="space-y-2">
          {data?.users.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-fg-3 text-xs">{ago(r.createdAt)} · {name(r.reporterPlayerId)} reported <b className="text-fg">{name(r.targetPlayerId)}</b>{who(r.targetPlayerId)?.user?.bannedAt && " · already banned"}</div>
                <p className="mt-1.5">“{r.reason}”</p>
                {r.context && <p className="text-fg-2 mt-1 text-sm">{r.context}</p>}
              </div>
              {status === "OPEN" && (
                <div className="flex gap-1.5">
                  <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => act("user", r.id, "resolve")}>Handled</button>
                  <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => act("user", r.id, "dismiss")}>Dismiss</button>
                </div>
              )}
            </li>
          ))}
          {data && data.users.length === 0 && <li className="card text-fg-2 p-5 text-center text-sm">No {status.toLowerCase()} player reports. Ban accounts from the Users tab.</li>}
        </ul>
      </section>
    </div>
  );
}
