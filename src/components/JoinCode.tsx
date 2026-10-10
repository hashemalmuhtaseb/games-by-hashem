"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Five boxes, one input underneath: type or paste a code and it reads like the code on the host's screen. */
export function JoinCode({ compact }: { compact?: boolean }) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const ready = /^[A-Z0-9]{5}$/.test(code);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) router.push(`/room/${code}`);
      }}
    >
      <label className="relative flex-1 cursor-text" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          className="absolute inset-0 h-full w-full opacity-0"
          maxLength={5}
          value={code}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5))}
          aria-label="Room code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
        <span className="grid grid-cols-5 gap-1.5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => {
            const active = focused && (i === code.length || (i === 4 && code.length === 5));
            return (
              <span
                key={i}
                className={`grid place-items-center rounded-[var(--radius-sm)] bg-surface-2 font-mono font-medium text-fg transition-shadow duration-150 ${compact ? "h-9 text-base" : "h-11 text-lg"} ${active ? "shadow-[inset_0_0_0_1px_var(--color-accent-line)]" : "shadow-[inset_0_0_0_1px_var(--color-line)]"}`}
              >
                {code[i] ?? (active ? <span className="h-5 w-px animate-pulse bg-accent" /> : "")}
              </span>
            );
          })}
        </span>
      </label>
      <button className={`${ready ? "btn-primary" : "btn-ghost"} ${compact ? "min-h-9" : "min-h-11"} shrink-0 px-4`} disabled={!ready}>
        Join
      </button>
    </form>
  );
}
