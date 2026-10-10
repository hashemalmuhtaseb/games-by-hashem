"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";

/**
 * A modal sheet: centred on desktop, rising from the bottom on phones. Escape and the backdrop close
 * it, focus moves in on open and returns to the opener on close, and Tab stays inside.
 */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => (panel.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])") ?? panel.current)?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input, textarea, select, [tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="popover relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-b-none bg-surface-2 outline-none sm:rounded-b-[var(--radius-md)]"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 id={id} className="text-[17px] font-semibold text-fg">
                {title}
              </h2>
              <button data-close className="btn-icon -mr-2 h-9 min-h-9 w-9" onClick={onClose} aria-label="Close">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
