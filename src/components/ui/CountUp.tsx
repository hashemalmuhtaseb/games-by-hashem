"use client";
import { useEffect, useRef, useState } from "react";

/** A number that rolls to its new value instead of jumping. Short and eased; instant with reduced motion. */
export function CountUp({ value, className, duration = 520 }: { value: number; className?: string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * e);
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{shown.toLocaleString()}</span>;
}
