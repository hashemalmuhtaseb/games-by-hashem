"use client";

import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { useAdmin, ago } from "./useAdmin";

interface Provider { id: string; label: string; verified: boolean; topics: string[]; unavailable: string | null }
interface Job { id: string; provider: string; status: string; params: { topic?: string; count?: number; autoPublish?: boolean }; produced: number; accepted: number; rejected: number; log: { question: string; ok: boolean; reasons: string[] }[]; error: string | null; createdAt: string }

export function Generate({ onReview }: { onReview: () => void }) {
  const { data, reload } = useAdmin<{ providers: Provider[]; jobs: Job[] }>("/api/admin/content");
  const [provider, setProvider] = useState("facts");
  const [topic, setTopic] = useState("any");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState(2);
  const [autoPublish, setAutoPublish] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const running = data?.jobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [running, reload]);
  const p = data?.providers.find((x) => x.id === provider);

  async function start() {
    try {
      await api("/api/admin/content", { body: { provider, topic, count, difficulty, autoPublish: !!p?.verified && autoPublish } });
      setMsg("Job started.");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Generate questions</h2>
          <p className="text-ink-300 mt-1 text-sm">New questions feed the “Community picks” mode in Trivia Roulette and Quickfire. Every draft passes schema, giveaway, language and near-duplicate checks. Dataset templates are true by construction and can publish directly; AI drafts always go to the review queue.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {data?.providers.map((x) => (
            <button key={x.id} disabled={!!x.unavailable} onClick={() => { setProvider(x.id); setTopic(x.topics[0]); }} className={`rounded-xl border p-3 text-left transition ${provider === x.id ? "border-brand-500 bg-brand-500/10" : "border-white/10 hover:bg-white/5"} disabled:opacity-50`}>
              <div className="font-semibold">{x.label}</div>
              <div className="text-ink-400 mt-0.5 text-xs">{x.unavailable ? `Off: ${x.unavailable}` : x.verified ? "Verified facts · no API key needed" : "Unverified · human review required"}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm"><span className="label">Topic</span>
            <select className="input w-48 py-2" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {p?.topics.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm"><span className="label">How many</span>
            <input type="number" className="input w-24 py-2" min={1} max={25} value={count} onChange={(e) => setCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))} />
          </label>
          <label className="grid gap-1 text-sm"><span className="label">Difficulty</span>
            <select className="input w-28 py-2" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{"★".repeat(d)}</option>)}
            </select>
          </label>
          {p?.verified && (
            <label className="chip cursor-pointer py-2"><input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} /> publish immediately</label>
          )}
          <button className="btn-primary" disabled={!p || !!p.unavailable || running} onClick={start}>{running ? "Running…" : "Generate"}</button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Recent jobs</h2>
        <ul className="space-y-2">
          {data?.jobs.map((j) => (
            <li key={j.id} className="card p-4">
              <button className="flex w-full flex-wrap items-center gap-3 text-left text-sm" onClick={() => setOpen(open === j.id ? null : j.id)}>
                <span className={`font-bold ${j.status === "SUCCEEDED" ? "text-good-400" : j.status === "FAILED" ? "text-bad-400" : "text-warn-400"}`}>{j.status.toLowerCase()}</span>
                <span>{j.provider}</span>
                <span className="text-ink-300">{j.params.topic} × {j.params.count}</span>
                <span className="text-good-400">{j.accepted} accepted</span>
                <span className="text-bad-400">{j.rejected} rejected</span>
                <span className="text-ink-400 ml-auto">{ago(j.createdAt)}</span>
              </button>
              {j.error && <p className="text-bad-400 mt-2 text-sm">{j.error}</p>}
              {open === j.id && (
                <ul className="mt-3 space-y-1 text-sm">
                  {j.log.map((l, i) => (
                    <li key={i} className={l.ok ? "" : "text-ink-400"}>{l.ok ? "✓" : "✗"} {l.question}{!l.ok && <span className="text-bad-400"> — {l.reasons.join("; ")}</span>}</li>
                  ))}
                  {j.accepted > 0 && !j.params.autoPublish && <li><button className="text-brand-400 mt-1 font-semibold" onClick={onReview}>Review the accepted drafts →</button></li>}
                </ul>
              )}
            </li>
          ))}
          {data && data.jobs.length === 0 && <li className="card text-ink-300 p-5 text-center text-sm">No jobs yet.</li>}
        </ul>
      </section>
    </div>
  );
}
