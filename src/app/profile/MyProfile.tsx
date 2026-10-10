"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { Avatar } from "@/components/Avatar";
import { ProfileView } from "@/components/ProfileView";
import { AvatarUploader } from "@/components/AvatarUploader";

const AVATARS = ["🦊", "🐼", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲", "🦉", "🐧", "🦖", "🐨", "🐵", "🦈", "🐝", "🦩", "🐺", "🦝", "🐬", "🦜", "👾", "🤖", "👽", "🎃"];
const COLORS = ["#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#eab308", "#ef4444", "#3b82f6", "#14b8a6", "#a855f7"];

interface FriendRow {
  id: string;
  player: { id: string; displayName: string; avatar: string; photo: string | null; color: string; lastSeenAt: string };
}

export function MyProfile() {
  const { me, user, refresh } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [friends, setFriends] = useState<{ friends: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] } | null>(null);
  const [friendName, setFriendName] = useState("");
  const [friendMsg, setFriendMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const loadFriends = useCallback(() => api<typeof friends>("/api/friends").then(setFriends, () => undefined), []);
  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);
  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setBio(me.bio);
    }
  }, [me]);
  if (!me) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-40 animate-pulse rounded-2xl bg-white/5" /></div>;
  const patch = async (body: Record<string, unknown>) => {
    try {
      await api("/api/me", { method: "PATCH", body });
      await refresh();
      setErr(null);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    }
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {me.isGuest && (
        <div className="card mb-6 flex flex-col items-center justify-between gap-3 border-brand-500/30 p-5 sm:flex-row">
          <div>
            <div className="font-semibold text-white">You&apos;re playing as a guest</div>
            <div className="text-sm text-ink-400">Create a free account to keep your progress across devices, add friends and appear by name on leaderboards.</div>
          </div>
          <Link href="/login" className="btn-primary shrink-0">
            Create account
          </Link>
        </div>
      )}
      <ProfileView p={me}>
        <div className="flex flex-col gap-2">
          <button className="btn-ghost text-sm" onClick={() => setEditing((e) => !e)}>
            ✏️ Edit profile
          </button>
          <Link href={`/u/${me.id}`} className="btn-ghost text-sm">
            Public view
          </Link>
          {user ? (
            <button
              className="text-xs text-ink-400 hover:text-white"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                await refresh();
              }}
            >
              Sign out
            </button>
          ) : (
            <Link href="/login" className="text-center text-xs text-ink-400 hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      </ProfileView>
      {editing && (
        <div className="card mt-6 flex flex-col gap-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label">Display name</span>
              <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Bio</span>
              <input className="input" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Flag nerd. Rare-words menace." />
            </label>
          </div>
          <div>
            <div className="label mb-2">Profile picture</div>
            {uploading ? (
              <AvatarUploader
                onCancel={() => setUploading(false)}
                onSaved={async () => {
                  await refresh();
                  setUploading(false);
                  setErr(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Avatar avatar={me.avatar} photo={me.photo} color={me.color} size={64} />
                <button className="btn-ghost text-sm" onClick={() => setUploading(true)}>
                  {me.photo ? "Change photo" : "Upload a photo"}
                </button>
                {me.photo && (
                  <button
                    className="text-sm text-ink-400 hover:text-bad-400"
                    onClick={async () => {
                      try {
                        await api("/api/me/avatar", { method: "DELETE" });
                        await refresh();
                      } catch (e) {
                        setErr((e as Error).message);
                      }
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="label mb-2">{me.photo ? "Fallback avatar" : "Avatar"}</div>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => void patch({ avatar: a })} className={`rounded-full ${me.avatar === a ? "ring-2 ring-brand-400" : ""}`}>
                  <Avatar avatar={a} color={me.color} size={42} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Colour</div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => void patch({ color: c })} aria-label={`Colour ${c}`} className={`h-8 w-8 rounded-full ${me.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-bad-400">{err}</p>}
          <button className="btn-primary self-start" onClick={async () => (await patch({ displayName: name, bio })) && setEditing(false)}>
            Save
          </button>
        </div>
      )}
      <div className="card mt-6 p-6">
        <h2 className="label mb-3">Friends</h2>
        {user ? (
          <form
            className="mb-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/friends", { body: { username: friendName } });
                setFriendMsg("Request sent!");
                setFriendName("");
                void loadFriends();
              } catch (x) {
                setFriendMsg((x as Error).message);
              }
            }}
          >
            <input className="input py-2" placeholder="Add by username" value={friendName} onChange={(e) => setFriendName(e.target.value)} maxLength={20} />
            <button className="btn-ghost">Add</button>
          </form>
        ) : (
          <p className="mb-3 text-sm text-ink-400">Create an account to add friends.</p>
        )}
        {friendMsg && <p className="mb-3 text-sm text-ink-300">{friendMsg}</p>}
        {friends?.incoming.map((f) => (
          <div key={f.id} className="mb-2 flex items-center gap-3 rounded-xl bg-brand-500/10 px-3 py-2">
            <Avatar avatar={f.player.avatar} photo={f.player.photo} color={f.player.color} size={30} />
            <span className="flex-1 text-white">{f.player.displayName} wants to be friends</span>
            <button className="btn-primary px-3 py-1 text-sm" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "accept" } }).then(loadFriends)}>
              Accept
            </button>
            <button className="text-sm text-ink-400" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "remove" } }).then(loadFriends)}>
              Decline
            </button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          {friends?.friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <Avatar avatar={f.player.avatar} photo={f.player.photo} color={f.player.color} size={30} />
              <Link href={`/u/${f.player.id}`} className="flex-1 text-white hover:underline">
                {f.player.displayName}
              </Link>
              <span className="text-xs text-ink-400">{Date.now() - new Date(f.player.lastSeenAt).getTime() < 300_000 ? "🟢 online" : ""}</span>
              <button className="text-xs text-ink-400 hover:text-bad-400" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "remove" } }).then(loadFriends)}>
                Remove
              </button>
            </div>
          ))}
          {friends?.outgoing.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2 opacity-60">
              <Avatar avatar={f.player.avatar} photo={f.player.photo} color={f.player.color} size={30} />
              <span className="flex-1 text-white">{f.player.displayName}</span>
              <span className="text-xs text-ink-400">pending</span>
            </div>
          ))}
        </div>
        {friends && !friends.friends.length && !friends.incoming.length && !friends.outgoing.length && user && <p className="text-sm text-ink-400">No friends yet. Add someone by username, or share a room code.</p>}
      </div>
    </div>
  );
}
