"use client";
import { motion } from "framer-motion";
import { useId } from "react";

/** A segmented control. The selection slides between options; arrow keys move it. */
export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; className?: string; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div className={className}>
      <div
        role="radiogroup"
        className="inline-flex rounded-[10px] bg-surface-1 p-[3px] shadow-[inset_0_0_0_1px_var(--color-line)]"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = options.findIndex((o) => o.id === value);
          const n = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
          onChange(n.id);
          (e.currentTarget.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null)?.focus();
        }}
      >
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              data-id={o.id}
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.id)}
              className={`relative rounded-[7px] font-medium whitespace-nowrap transition-colors duration-150 ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${on ? "text-fg" : "text-fg-3 hover:text-fg-2"}`}
            >
              {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[7px] bg-surface-3 shadow-[inset_0_0_0_1px_var(--color-line-strong)]" transition={{ type: "tween", duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
