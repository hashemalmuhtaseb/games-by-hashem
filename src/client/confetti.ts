"use client";
import confetti from "canvas-confetti";

export function burst(intensity: "small" | "big" = "small") {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#8b5cf6", "#ec4899", "#22d3ee", "#facc15", "#4ade80"];
  if (intensity === "small") {
    void confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    return;
  }
  const end = Date.now() + 1400;
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
