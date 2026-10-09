"use client";

import { useState } from "react";
import { api } from "@/client/api";
import { useAdmin, qs, ago } from "./useAdmin";

interface Row {
  id: string;
  contentKey: string;
  gameSlug: string;
  topic: string;
  difficulty: number;
  status: string;
  origin: string;
  prompt: { question?: string; correct?: string; wrong?: string[]; explanation?: string; mode?: string; ref?: string };
  playCount: number;
  reportCount: number;
  updatedAt: string;
  source: { name: string; license: string } | null;
}

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "text-good-400",
  PENDING_REVIEW: "text-warn-400",
  DRAFT: "text-ink-300",
  REJECTED: "text-bad-400",
  RETIRED: "text-bad-400",
};

export function Questions({ preset, reviewMode }: { preset: { status?: string }; reviewMode?: boolean }) {
  const [status, setStatus] = useState(preset.status ?? "");
  const [origin, setOrigin] = useState("");
  const [custom, setCustom] = useState(false);
  const [reported, setReported] = useState(false);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const url = `/api/admin/questions${qs({ status, origin, custom: custom ? "1" : "", reported: reported ? "1" : "", q: search, page })}`;
  const { data, error, reload } = useAdmin<{ total: number; rows: Row[] }>(url);

  async function update(ids: string[], patch: Record<string, unknown>) {
    try {
      const r = await api<{ updated: number }>("/api/admin/questions", { method: "PATCH", body: { ids, ...patch } });
      setMsg(`Updated ${r.updated} question${r.updated === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  const rows = data?.rows ?? [];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-4">
      {reviewMode ? (
        <p className="text-ink-300 text-sm">AI drafts and editor submissions wait here. Automatic checks already removed malformed questions, giveaways and near-duplicates, but only a person can confirm a fact is true. Publish what you have checked; reject the rest.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">Any status</option>
            {["PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED", "RETIRED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </select>
          <select className="input w-auto py-2" value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(0); }}>
            <option value="">Any origin</option>
            {["DATASET", "ADMIN", "AI", "IMPORT"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </select>
          <label className="chip cursor-pointer"><input type="checkbox" checked={custom} onChange={(e) => { setCustom(e.target.checked); setPage(0); }} /> custom only</label>
          <label className="chip cursor-pointer"><input type="checkbox" checked={reported} onChange={(e) => { setReported(e.target.checked); setPage(0); }} /> reported</label>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(0); }}>
            <input className="input w-56 py-2" placeholder="Search key or topic…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-ghost">Search</button>
          </form>
          <button className="btn-primary ml-auto" onClick={() => setCreating((v) => !v)}>{creating ? "Close" : "+ Write a question"}</button>
        </div>
      )}
      {creating && <CreateForm onDone={(m) => { setMsg(m); setCreating(false); void reload(); }} />}
      {msg && <p className="text-ink-100 rounded-xl bg-white/5 px-3 py-2 text-sm">{msg}</p>}
      {error && <p className="text-bad-400">{error}</p>}
      {selected.size > 0 && (
        <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button className="btn-primary py-1.5" onClick={() => update([...selected], { status: "PUBLISHED" })}>Publish</button>
          <button className="btn-ghost py-1.5" onClick={() => update([...selected], { status: "REJECTED" })}>Reject</button>
          <button className="btn-ghost py-1.5" onClick={() => update([...selected], { status: "RETIRED" })}>Retire</button>
          <button className="btn-ghost py-1.5" onClick={() => update([...selected], { clearReports: true })}>Clear reports</button>
          <button className="text-ink-300 ml-auto text-sm" onClick={() => setSelected(new Set())}>Deselect</button>
        </div>
      )}
      <div className="text-ink-400 text-xs">{data ? `${data.total.toLocaleString()} questions` : "Loading…"}</div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <QuestionRow key={r.id} r={r} selected={selected.has(r.id)} onToggle={() => toggle(r.id)} onUpdate={(p) => update([r.id], p)} />
        ))}
        {data && rows.length === 0 && <li className="card text-ink-300 p-6 text-center">{reviewMode ? "Nothing waiting for review. 🎉" : "No questions match."}</li>}
      </ul>
      {data && data.total > 50 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="text-ink-300 text-sm">Page {page + 1} of {Math.ceil(data.total / 50)}</span>
          <button className="btn-ghost" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

function QuestionRow({ r, selected, onToggle, onUpdate }: { r: Row; selected: boolean; onToggle: () => void; onUpdate: (patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const custom = r.contentKey.startsWith("custom:");
  const p = r.prompt;
  return (
    <li className={`card p-4 ${selected ? "ring-brand-500 ring-2" : ""}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={selected} onChange={onToggle} aria-label="Select question" />
        <div className="min-w-0 flex-1">
          <div className="text-ink-400 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={`font-bold ${STATUS_TONE[r.status] ?? ""}`}>{r.status.replace("_", " ")}</span>
            <span className="font-mono">{r.contentKey}</span>
            <span>{r.gameSlug}</span>
            <span>{r.topic}</span>
            <span>{"★".repeat(r.difficulty)}</span>
            <span>{r.origin.toLowerCase()}</span>
            {r.reportCount > 0 && <span className="text-bad-400 font-semibold">🚩 {r.reportCount}</span>}
            <span>{ago(r.updatedAt)}</span>
          </div>
          {custom && p.question ? (
            editing ? (
              <EditForm r={r} onDone={() => setEditing(false)} onSave={(prompt) => { onUpdate({ prompt }); setEditing(false); }} />
            ) : (
              <div className="mt-2">
                <p className="font-semibold">{p.question}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  <span className="bg-good-500/15 text-good-400 rounded-lg px-2 py-0.5">✓ {p.correct}</span>
                  {p.wrong?.map((w) => <span key={w} className="text-ink-300 rounded-lg bg-white/5 px-2 py-0.5">{w}</span>)}
                </div>
                {p.explanation && <p className="text-ink-300 mt-2 text-sm">{p.explanation}</p>}
              </div>
            )
          ) : (
            <p className="text-ink-300 mt-2 text-sm">Generated from {r.source?.name ?? "the bundled datasets"} (mode <code>{p.mode}</code>, item <code>{p.ref}</code>). Retire it to stop it being served.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {r.status !== "PUBLISHED" && <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => onUpdate({ status: "PUBLISHED" })}>Publish</button>}
          {r.status === "PENDING_REVIEW" && <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => onUpdate({ status: "REJECTED" })}>Reject</button>}
          {r.status === "PUBLISHED" && <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => onUpdate({ status: "RETIRED" })}>Retire</button>}
          {custom && !editing && <button className="text-ink-300 text-sm hover:text-white" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      </div>
    </li>
  );
}

interface PromptIn { question: string; correct: string; wrong: string[]; explanation: string }

function PromptFields({ v, set }: { v: PromptIn; set: (v: PromptIn) => void }) {
  return (
    <div className="grid gap-2">
      <input className="input" placeholder="Question (ends with ?)" value={v.question} onChange={(e) => set({ ...v, question: e.target.value })} maxLength={240} />
      <input className="input border-good-500/40" placeholder="Correct answer" value={v.correct} onChange={(e) => set({ ...v, correct: e.target.value })} maxLength={80} />
      <div className="grid gap-2 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <input key={i} className="input" placeholder={`Wrong answer ${i + 1}`} value={v.wrong[i] ?? ""} maxLength={80} onChange={(e) => { const w = [...v.wrong]; w[i] = e.target.value; set({ ...v, wrong: w }); }} />
        ))}
      </div>
      <input className="input" placeholder="Explanation shown after the reveal (optional)" value={v.explanation} onChange={(e) => set({ ...v, explanation: e.target.value })} maxLength={300} />
    </div>
  );
}

const clean = (v: PromptIn) => ({ question: v.question, correct: v.correct, wrong: v.wrong, ...(v.explanation.trim() ? { explanation: v.explanation } : {}) });

function EditForm({ r, onSave, onDone }: { r: Row; onSave: (p: unknown) => void; onDone: () => void }) {
  const [v, setV] = useState<PromptIn>({ question: r.prompt.question ?? "", correct: r.prompt.correct ?? "", wrong: r.prompt.wrong ?? ["", "", ""], explanation: r.prompt.explanation ?? "" });
  return (
    <div className="mt-3 space-y-2">
      <PromptFields v={v} set={setV} />
      <div className="flex gap-2">
        <button className="btn-primary py-1.5" onClick={() => onSave(clean(v))}>Save</button>
        <button className="btn-ghost py-1.5" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: (msg: string) => void }) {
  const [v, setV] = useState<PromptIn>({ question: "", correct: "", wrong: ["", "", ""], explanation: "" });
  const [topic, setTopic] = useState("general knowledge");
  const [difficulty, setDifficulty] = useState(2);
  const [err, setErr] = useState<string | null>(null);
  async function save(publish: boolean) {
    try {
      const r = await api<{ contentKey: string }>("/api/admin/questions", { body: { prompt: clean(v), topic, difficulty, publish } });
      onDone(`Saved ${r.contentKey}${publish ? " and published to Trivia Roulette and Quickfire" : " to the review queue"}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-semibold">New multiple-choice question</h3>
      <PromptFields v={v} set={setV} />
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56 py-2" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
        <select className="input w-auto py-2" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{"★".repeat(d)}</option>)}
        </select>
        <button className="btn-ghost" onClick={() => save(false)}>Save for review</button>
        <button className="btn-primary" onClick={() => save(true)}>Publish now</button>
      </div>
      {err && <p className="text-bad-400 text-sm">{err}</p>}
    </div>
  );
}
