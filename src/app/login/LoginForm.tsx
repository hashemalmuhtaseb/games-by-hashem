"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { Segmented } from "@/components/ui/Segmented";

export function LoginForm() {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh, me } = useMe();
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-sm flex-col justify-center px-5 py-16">
      <h1 className="serif text-center text-[40px] leading-none text-fg">{tab === "register" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-3 text-center text-sm text-fg-3">{tab === "register" ? "Keep your progress on every device." : "Sign in to pick up where you left off."}</p>

      <Segmented
        value={tab}
        onChange={(t) => {
          setTab(t);
          setErr(null);
        }}
        options={[
          { id: "register", label: "Create account" },
          { id: "login", label: "Sign in" },
        ]}
        className="mt-8 flex justify-center"
      />

      {tab === "register" && me?.isGuest && me.gamesPlayed > 0 && (
        <p className="well mt-6 px-4 py-3 text-sm text-fg-2">
          Your guest progress comes with you: <span className="num text-fg">{me.gamesPlayed}</span> games, level <span className="num text-fg">{me.level}</span>.
        </p>
      )}

      <form
        className="mt-6 flex flex-col gap-4"
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
        <label className="flex flex-col gap-1.5">
          <span className="label">Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} maxLength={20} required />
          {tab === "register" && <span className="text-xs text-fg-3">3 to 20 letters, numbers or underscores.</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} minLength={tab === "register" ? 8 : 1} required />
          {tab === "register" && <span className="text-xs text-fg-3">At least 8 characters.</span>}
        </label>
        {err && (
          <p role="alert" className="text-sm text-bad-400">
            {err}
          </p>
        )}
        <button className="btn-primary btn-lg mt-2" disabled={busy}>
          {busy ? <span className="spinner h-4 w-4 border-accent-ink/30 border-t-accent-ink" /> : tab === "register" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-8 text-center text-[13px] leading-relaxed text-fg-3">No account needed to play. Guests keep their progress on this device.</p>
    </div>
  );
}
