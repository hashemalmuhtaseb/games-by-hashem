"use client";
import { motion } from "framer-motion";
import type { MediaRef } from "@/engine/types";

/* eslint-disable @next/next/no-img-element */
export function MediaView({ m, size = "lg" }: { m: MediaRef; size?: "sm" | "md" | "lg" }) {
  switch (m.type) {
    case "image": {
      const flag = m.frame === "flag";
      const max = size === "lg" ? "max-h-64 sm:max-h-72" : size === "md" ? "max-h-40" : "max-h-14";
      return (
        <motion.img
          key={m.url}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          src={m.url}
          alt={m.alt}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className={`${max} w-auto max-w-full select-none object-contain ${flag ? "rounded-md shadow-[0_10px_40px_-10px_rgb(0_0_0/0.8)] ring-1 ring-white/10" : "rounded-xl"}`}
        />
      );
    }
    case "emoji":
      return <div className={`${size === "lg" ? "text-6xl sm:text-7xl" : "text-4xl"} leading-tight tracking-widest select-none`}>{m.value}</div>;
    case "quote":
      return (
        <blockquote className="display max-w-2xl text-center text-2xl font-semibold text-white sm:text-3xl">
          <span className="text-brand-400">“</span>
          {m.text}
          <span className="text-brand-400">”</span>
          {m.by && <footer className="mt-2 text-base font-normal text-ink-400">— {m.by}</footer>}
        </blockquote>
      );
    case "facts":
      return (
        <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
          {m.items.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
              <div className="label">{f.label}</div>
              <div className="font-semibold text-white">{f.value}</div>
            </motion.div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="w-full max-w-xl">
          {m.title && <div className="label mb-2">{m.title}</div>}
          <ol className="relative space-y-2 border-l border-brand-500/40 pl-5">
            {m.items.map((it, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative font-medium text-white">
                <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-ink-850" />
                {it}
              </motion.li>
            ))}
          </ol>
        </div>
      );
    case "audio":
      return (
        <div className="flex flex-col items-center gap-2">
          <audio src={m.url} controls autoPlay className="w-72" controlsList="nodownload noplaybackrate" />
          <span className="text-xs text-ink-400">{m.attribution}</span>
        </div>
      );
    case "words":
      return (
        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          {m.items.map((w, i) => (
            <motion.span key={w + i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-lg font-semibold text-white">
              {w}
            </motion.span>
          ))}
        </div>
      );
  }
}
