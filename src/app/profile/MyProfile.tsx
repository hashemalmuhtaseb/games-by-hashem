"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { Avatar } from "@/components/Avatar";
import { ProfileView } from "@/components/ProfileView";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

const AVATARS = ["🦊", "🐼", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲", "🦉", "🐧", "🦖", "🐨", "🐵", "🦈", "🐝", "🦩", "🐺", "🦝", "🐬", "🦜", "👾", "🤖", "👽", "🎃"];
/** Player colours: ten hues at matched lightness so no one's name shouts louder than anyone else's. */
const COLORS = ["#f27a6f", "#eea676", "#e8cf6a", "#8fcf7f", "#6fd0bf", "#7cc4e8", "#8fb3ff", "#b6a3f0", "#ee93b2", "#b0aea6"];

interface FriendRow {
  id: string;
  player: { id: string; displayName: string; avatar: string; color: string; lastSeenAt: string };
}

export function MyProfile() {
  const { me, user, refresh } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [friends, setFriends] = useState<{ friends: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] } | null>(null);
  const [friendName, setFriendName] = useState("");
  const [friendMsg, setFriendMsg] = useState<{ text: string; ok: boolean } | null>(null);
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
  const close = useCallback(() => setEditing(false), []);
  if (!me)
    return (
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div className="flex items-end gap-6">
          <div className="skeleton h-24 w-24 rounded-full" />
          <div className="flex flex-col gap-3">
            <div className="skeleton h-10 w-64" />
            <div className="skeleton h-4 w-40" />
          </div>
        </div>
      </div>
    );
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
  const online = (iso: string) => Date.now() - new Date(iso).getTime() < 300_000;
  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
      {me.isGuest && (
        <div className="mb-12 flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-1 p-5 shadow-[inset_0_0_0_1px_var(--color-line)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-fg">You&apos;re playing as a guest</div>
            <div className="mt-0.5 text-sm text-fg-3">Create an account to keep your progress on every device, add friends and appear by name on leaderboards.</div>
          </div>
          <Link href="/login" className="btn-primary shrink-0">
            Create account
          </Link>
        </div>
      )}
      <ProfileView p={me}>
        <div className="flex gap-2 sm:flex-col sm:items-end">
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size={15} />
            Edit profile
          </button>
          <div className="flex items-center gap-3 text-[13px] text-fg-3">
            <Link href={`/u/${me.id}`} className="transition-colors hover:text-fg">
              Public view
            </Link>
            {user ? (
              <button
                className="transition-colors hover:text-fg"
                onClick={async () => {
                  await api("/api/auth/logout", { method: "POST" });
                  await refresh();
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="transition-colors hover:text-fg">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </ProfileView>

      <Dialog
        open={editing}
        onClose={close}
        title="Edit profile"
        footer={
          <>
            <button className="btn-quiet" onClick={close}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={saving || !name.trim()}
              onClick={async () => {
                setSaving(true);
                if (await patch({ displayName: name, bio })) setEditing(false);
                setSaving(false);
              }}
            >
              {saving ? "Saving" : "Save"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Avatar avatar={me.avatar} color={me.color} size={64} />
            <div className="text-sm text-fg-3">Pick an avatar and a colour. Changes to these save straight away.</div>
          </div>
          <div>
            <div className="label mb-2">Avatar</div>
            <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a) => (
                <button key={a} role="radio" aria-checked={me.avatar === a} onClick={() => void patch({ avatar: a })} className={`grid aspect-square place-items-center rounded-[var(--radius-sm)] text-xl transition-colors ${me.avatar === a ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "bg-surface-3 hover:bg-surface-4"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Colour</div>
            <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={me.color === c}
                  onClick={() => void patch({ color: c })}
                  aria-label={`Colour ${c}`}
                  className="h-8 w-8 rounded-full transition-shadow"
                  style={{ background: c, boxShadow: me.color === c ? `0 0 0 2px var(--color-surface-2), 0 0 0 4px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">Display name</span>
            <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between">
              <span className="label">Bio</span>
              <span className="num text-xs text-fg-3">{bio.length}/280</span>
            </span>
            <textarea className="input min-h-20 resize-none py-2.5" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Flag nerd. Rare-words menace." rows={3} />
          </label>
          {err && (
            <p role="alert" className="text-sm text-bad-400">
              {err}
            </p>
          )}
        </div>
      </Dialog>

      <section aria-labelledby="friends" className="mt-16">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="friends" className="text-[15px] font-semibold text-fg">
            Friends
          </h2>
          {user && (
            <form
              className="flex gap-2 sm:w-80"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api("/api/friends", { body: { username: friendName } });
                  setFriendMsg({ text: "Request sent", ok: true });
                  setFriendName("");
                  void loadFriends();
                } catch (x) {
                  setFriendMsg({ text: (x as Error).message, ok: false });
                }
              }}
            >
              <input className="input min-h-9 py-1.5 text-sm" placeholder="Add by username" value={friendName} onChange={(e) => setFriendName(e.target.value)} maxLength={20} aria-label="Friend's username" />
              <button className="btn-ghost btn-sm min-h-9" disabled={!friendName.trim()}>
                Add
              </button>
            </form>
          )}
        </div>
        {friendMsg && <p className={`mb-3 text-sm ${friendMsg.ok ? "text-good-400" : "text-bad-400"}`}>{friendMsg.text}</p>}
        {!user && <p className="border-y border-line py-6 text-sm text-fg-3">Create an account to add friends.</p>}
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {friends?.incoming.map((f) => (
            <li key={f.id} className="flex items-center gap-3 border-b border-line py-3 sm:col-span-2">
              <Avatar avatar={f.player.avatar} color={f.player.color} size={32} />
              <span className="flex-1 text-sm text-fg">
                <span className="font-medium">{f.player.displayName}</span> <span className="text-fg-3">wants to be friends</span>
              </span>
              <button className="btn-quiet btn-sm" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "remove" } }).then(loadFriends)}>
                Decline
              </button>
              <button className="btn-primary btn-sm" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "accept" } }).then(loadFriends)}>
                Accept
              </button>
            </li>
          ))}
          {friends?.friends.map((f) => (
            <li key={f.id} className="group flex items-center gap-3 border-b border-line py-3">
              <span className="relative">
                <Avatar avatar={f.player.avatar} color={f.player.color} size={32} />
                {online(f.player.lastSeenAt) && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-good-400 shadow-[0_0_0_2px_var(--color-canvas)]" aria-label="Online" />}
              </span>
              <Link href={`/u/${f.player.id}`} className="flex-1 text-sm font-medium text-fg hover:underline">
                {f.player.displayName}
              </Link>
              <button className="text-xs text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-bad-400 focus-visible:opacity-100" onClick={() => void api("/api/friends", { method: "PATCH", body: { id: f.id, action: "remove" } }).then(loadFriends)}>
                Remove
              </button>
            </li>
          ))}
          {friends?.outgoing.map((f) => (
            <li key={f.id} className="flex items-center gap-3 border-b border-line py-3 opacity-60">
              <Avatar avatar={f.player.avatar} color={f.player.color} size={32} />
              <span className="flex-1 text-sm text-fg">{f.player.displayName}</span>
              <span className="text-xs text-fg-3">Pending</span>
            </li>
          ))}
        </ul>
        {friends && !friends.friends.length && !friends.incoming.length && !friends.outgoing.length && user && <p className="border-y border-line py-6 text-sm text-fg-3">No friends yet. Add someone by username, or share a room code.</p>}
      </section>
    </div>
  );
}
