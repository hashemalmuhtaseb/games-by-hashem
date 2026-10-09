"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinCode({ compact }: { compact?: boolean }) {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (/^[A-Z0-9]{5}$/.test(c)) router.push(`/room/${c}`);
      }}
    >
      <input
        className={`input text-center font-mono text-lg tracking-[0.3em] uppercase ${compact ? "py-2" : ""}`}
        placeholder="CODE"
        maxLength={5}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
        aria-label="Room code"
      />
      <button className="btn-ghost shrink-0" disabled={code.length !== 5}>
        Join
      </button>
    </form>
  );
}
