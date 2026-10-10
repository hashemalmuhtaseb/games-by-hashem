"use client";
import { useEffect, useRef, useState } from "react";
import { emit } from "@/client/socket";
import { Avatar } from "@/components/Avatar";
import type { ChatMsg } from "./types";

export const REACTIONS = ["👏", "😂", "🔥", "😮", "😭", "🤯", "👀", "💀", "🎉", "🤔"];

export function Chat({ messages, enabled, me }: { messages: ChatMsg[]; enabled: boolean; me: string }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [messages]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={ref} className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm">
        {messages.map((m) =>
          m.system && m.name === "Game Master" ? (
            <div key={m.id} className="rounded-xl border border-pink-400/20 bg-pink-400/5 px-3 py-2 text-sm">
              <div className="text-[11px] font-bold tracking-wide text-pink-300 uppercase">🎙️ Game Master</div>
              <div className="text-ink-100">{m.text}</div>
            </div>
          ) : m.system ? (
            <div key={m.id} className="text-center text-xs text-ink-400">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`leading-snug ${m.playerId === me ? "text-right" : ""}`}>
              <span className="inline-flex items-center gap-1 align-middle font-semibold" style={{ color: m.color }}>
                <Avatar avatar={m.avatar} photo={m.photo} color={m.color} size={18} /> {m.name}
              </span>{" "}
              <span className="break-words text-ink-100">{m.text}</span>
            </div>
          ),
        )}
        {!messages.length && <div className="pt-6 text-center text-xs text-ink-400">Say hi 👋</div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {REACTIONS.map((r) => (
          <button key={r} className="rounded-lg px-1.5 py-1 text-lg transition hover:scale-125 hover:bg-white/10" onClick={() => void emit("room:react", { emoji: r })} aria-label={`React ${r}`}>
            {r}
          </button>
        ))}
      </div>
      {enabled ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const r = await emit("room:chat", { text });
            if (r.error) setErr(r.error);
            else {
              setErr(null);
              setText("");
            }
          }}
        >
          <input className="input py-2 text-sm" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
          <button className="btn-ghost px-3 py-2 text-sm">Send</button>
        </form>
      ) : (
        <div className="mt-2 text-center text-xs text-ink-400">Chat is off in this room</div>
      )}
      {err && <div className="mt-1 text-xs text-bad-400">{err}</div>}
    </div>
  );
}
