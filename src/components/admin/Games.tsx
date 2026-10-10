"use client";

import { useState } from "react";
import { api } from "@/client/api";
import { useAdmin } from "./useAdmin";

interface Game { slug: string; name: string; icon: string; questionCount: number; enabled: boolean; config: { scoring?: Record<string, number> }; modes: { id: string; label: string; available: boolean; reason?: string }[] }
const FIELDS: { key: string; label: string; step: number }[] = [
  { key: "base", label: "Base points", step: 10 },
  { key: "speedBonus", label: "Max speed bonus", step: 10 },
  { key: "streakStep", label: "Streak step", step: 0.05 },
  { key: "streakCap", label: "Streak cap", step: 0.1 },
  { key: "cluePenalty", label: "Clue penalty", step: 0.05 },
  { key: "wrongAttemptPenalty", label: "Wrong-try penalty", step: 0.05 },
  { key: "minCorrectPoints", label: "Min correct points", step: 5 },
];

export function Games({ canEdit }: { canEdit: boolean }) {
  const { data, error, reload } = useAdmin<{ defaults: Record<string, number>; games: Game[] }>("/api/admin/games");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function save(slug: string, patch: object) {
    try {
      await api("/api/admin/games", { method: "PATCH", body: { slug, ...patch } });
      setMsg("Saved. Changes apply to new rounds within 30 seconds.");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }
  if (error) return <p className="text-bad-400">{error}</p>;
  return (
    <div className="space-y-3">
      {msg && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{msg}</p>}
      {!canEdit && <p className="text-fg-2 text-sm">Read-only: only admins can change game settings.</p>}
      {data?.games.map((g) => (
        <div key={g.slug} className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">{g.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{g.name} {!g.enabled && <span className="text-bad-400 text-xs">disabled</span>}</div>
              <div className="text-fg-3 text-xs">{g.questionCount.toLocaleString()} questions · {g.modes.filter((m) => m.available).length}/{g.modes.length} modes available</div>
            </div>
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setOpen(open === g.slug ? null : g.slug)}>{open === g.slug ? "Close" : "Details"}</button>
            {canEdit && (
              <button className={`${g.enabled ? "btn-danger" : "btn-primary"} px-3 py-1.5 text-sm`} onClick={() => save(g.slug, { enabled: !g.enabled })}>{g.enabled ? "Disable" : "Enable"}</button>
            )}
          </div>
          {open === g.slug && <GameDetails g={g} defaults={data.defaults} canEdit={canEdit} onSave={(scoring) => save(g.slug, { config: { scoring } })} />}
        </div>
      ))}
    </div>
  );
}

function GameDetails({ g, defaults, canEdit, onSave }: { g: Game; defaults: Record<string, number>; canEdit: boolean; onSave: (s: Record<string, number>) => void }) {
  const [s, setS] = useState<Record<string, string>>(Object.fromEntries(Object.entries(g.config.scoring ?? {}).map(([k, v]) => [k, String(v)])));
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="label mb-2">Modes</h3>
        <ul className="space-y-1 text-sm">
          {g.modes.map((m) => (
            <li key={m.id} className={m.available ? "" : "text-fg-3"}>{m.available ? "✓" : "○"} {m.label}{m.reason && <span className="text-xs"> — {m.reason}</span>}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="label mb-2">Scoring overrides (blank = default)</h3>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="grid gap-0.5 text-xs">
              <span className="text-fg-2">{f.label}</span>
              <input className="input py-1.5" type="number" step={f.step} disabled={!canEdit} placeholder={String(defaults[f.key])} value={s[f.key] ?? ""} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
            </label>
          ))}
        </div>
        {canEdit && (
          <button className="btn-primary mt-3 py-1.5" onClick={() => onSave(Object.fromEntries(Object.entries(s).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])))}>Save scoring</button>
        )}
      </div>
    </div>
  );
}
