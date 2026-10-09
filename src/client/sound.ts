"use client";

/**
 * Tiny synthesised sound kit (WebAudio) — no audio files, no licensing questions.
 * Respects a persisted mute toggle.
 */

let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem("pv:muted") === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("pv:muted", m ? "1" : "0");
  } catch {}
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export type Sfx = "click" | "correct" | "wrong" | "tick" | "reveal" | "win" | "join" | "streak" | "hint" | "start" | "pop";

export function play(s: Sfx) {
  if (isMuted()) return;
  switch (s) {
    case "click":
      return tone(600, 0, 0.05, "triangle", 0.05);
    case "pop":
      return tone(880, 0, 0.08, "sine", 0.06, 1320);
    case "correct":
      tone(660, 0, 0.12, "triangle", 0.1);
      return tone(990, 0.08, 0.2, "triangle", 0.1);
    case "wrong":
      tone(220, 0, 0.18, "sawtooth", 0.05, 150);
      return tone(165, 0.1, 0.25, "sawtooth", 0.04, 110);
    case "tick":
      return tone(1200, 0, 0.03, "square", 0.025);
    case "hint":
      return tone(520, 0, 0.12, "sine", 0.06, 780);
    case "reveal":
      return tone(440, 0, 0.3, "sine", 0.06, 880);
    case "streak":
      [660, 880, 1100].forEach((f, i) => tone(f, i * 0.06, 0.12, "triangle", 0.07));
      return;
    case "join":
      return tone(500, 0, 0.15, "sine", 0.06, 750);
    case "start":
      [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.18, "triangle", 0.08));
      return;
    case "win":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, "triangle", 0.09));
      return;
  }
}
