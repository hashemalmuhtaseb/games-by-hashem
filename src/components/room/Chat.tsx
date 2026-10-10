"use client";
import { useEffect, useRef, useState } from "react";
import { emit } from "@/client/socket";
import { Icon } from "@/components/ui/Icon";
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
      <div className="mb-2 text-[15px] font-semibold text-fg">Chat</div>
      <div ref={ref} className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2 text-sm" aria-live="polite">
        {messages.map((m) =>
          m.system && m.name === "Game Master" ? (
            <div key={m.id} className="well px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
                <Icon name="sparkle" size={12} className="text-accent" />
                Game Master
              </div>
              <div className="mt-0.5 leading-snug text-fg">{m.text}</div>
            </div>
          ) : m.system ? (
            <div key={m.id} className="py-0.5 text-center text-xs text-fg-3">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`flex flex-col ${m.playerId === me ? "items-end" : "items-start"}`}>
              {m.playerId !== me && (
                <span className="mb-0.5 px-1 text-[11px] font-medium" style={{ color: `color-mix(in oklab, ${m.color} 70%, var(--color-fg))` }}>
                  {m.name}
                </span>
              )}
              <span className={`max-w-[85%] rounded-[12px] px-3 py-1.5 leading-snug break-words ${m.playerId === me ? "bg-surface-4 text-fg" : "bg-surface-2 text-fg"}`}>{m.text}</span>
            </div>
          ),
        )}
        {!messages.length && <div className="pt-8 text-center text-xs text-fg-3">No messages yet</div>}
      </div>
      <div className="mt-3 flex justify-between gap-0.5" role="group" aria-label="Reactions">
        {REACTIONS.map((r) => (
          <button key={r} className="grid h-8 w-8 place-items-center rounded-[6px] text-lg transition-[background-color,transform] duration-100 hover:bg-surface-3 active:scale-90" onClick={() => void emit("room:react", { emoji: r })} aria-label={`React ${r}`}>
            {r}
          </button>
        ))}
      </div>
      {enabled ? (
        <form
          className="mt-2 flex gap-1.5"
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
          <input className="input min-h-9 py-1.5 text-sm" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="Chat message" />
          <button className="btn-ghost min-h-9 w-9 shrink-0 px-0" aria-label="Send" disabled={!text.trim()}>
            <Icon name="arrow-up-right" size={16} className="-rotate-45" />
          </button>
        </form>
      ) : (
        <div className="mt-2 text-center text-xs text-fg-3">Chat is off in this room</div>
      )}
      {err && <div className="mt-1 text-xs text-bad-400">{err}</div>}
    </div>
  );
}
