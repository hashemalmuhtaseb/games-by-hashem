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
          className={`${max} w-auto max-w-full select-none object-contain ${flag ? "rounded-[4px] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] ring-1 ring-white/10" : "rounded-xl"}`}
        />
      );
    }
    case "emoji":
      return <div className={`${size === "lg" ? "text-6xl sm:text-7xl" : "text-4xl"} leading-tight tracking-[0.12em] select-none`}>{m.value}</div>;
    case "quote":
      return (
        <figure className="max-w-2xl text-center">
          <blockquote className="serif text-[28px] leading-[1.25] text-fg sm:text-[34px]">&ldquo;{m.text}&rdquo;</blockquote>
          {m.by && <figcaption className="mt-3 text-sm text-fg-3">{m.by}</figcaption>}
        </figure>
      );
    case "facts":
      return (
        <dl className="grid w-full max-w-xl grid-cols-1 overflow-hidden rounded-[var(--radius-md)] bg-surface-1 shadow-[inset_0_0_0_1px_var(--color-line)] sm:grid-cols-2">
          {m.items.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-line px-4 py-3 not-first:border-t sm:[&:nth-child(2)]:border-t-0 sm:even:border-l">
              <dt className="label">{f.label}</dt>
              <dd className="mt-0.5 font-medium text-fg">{f.value}</dd>
            </motion.div>
          ))}
        </dl>
      );
    case "timeline":
      return (
        <div className="w-full max-w-xl">
          {m.title && <div className="label mb-3">{m.title}</div>}
          <ol className="relative flex flex-col gap-2.5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line-strong">
            {m.items.map((it, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="relative text-[16px] text-fg">
                <span className="absolute top-[7px] -left-6 h-[11px] w-[11px] rounded-full bg-canvas shadow-[inset_0_0_0_2px_var(--color-fg-3)]" />
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
          <span className="text-xs text-fg-3">{m.attribution}</span>
        </div>
      );
    case "words":
      return (
        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          {m.items.map((w, i) => (
            <motion.span key={w + i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-[var(--radius-sm)] bg-surface-2 px-4 py-2 text-lg font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)]">
              {w}
            </motion.span>
          ))}
        </div>
      );
  }
}
