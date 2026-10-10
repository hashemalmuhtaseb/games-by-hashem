"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";

export function LoginForm() {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh, me } = useMe();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="mb-6 flex rounded-xl bg-surface-1 p-1">
          {(["register", "login"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === t ? "bg-surface-3 text-fg" : "text-fg-3"}`}>
              {t === "register" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>
        {tab === "register" && me?.isGuest && me.gamesPlayed > 0 && (
          <p className="mb-4 rounded-xl bg-brand-500/10 px-4 py-3 text-sm text-brand-400">Your guest progress ({me.gamesPlayed} games, level {me.level}) will be kept.</p>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api(`/api/auth/${tab}`, { body: { username, password } });
              await refresh();
              router.push("/profile");
            } catch (x) {
              setErr((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="label">Username</span>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={20} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Password</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} minLength={tab === "register" ? 8 : 1} required />
          </label>
          {tab === "register" && <p className="text-xs text-fg-3">3–20 letters, numbers or _. Password: at least 8 characters.</p>}
          {err && <p className="text-sm text-bad-400">{err}</p>}
          <button className="btn-primary mt-2 py-3" disabled={busy}>
            {busy ? "…" : tab === "register" ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-fg-3">No account needed to play — guests keep their progress on this device.</p>
      </div>
    </div>
  );
}
