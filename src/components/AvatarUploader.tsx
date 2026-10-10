"use client";
import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIEW = 260; // px, the square crop window

/**
 * Pick a JPG/PNG/WebP, drag to reposition and zoom to crop, then save. The browser only sends the
 * original file plus the crop square; the server re-encodes it, so nothing unsafe is stored.
 */
export function AvatarUploader({ onSaved, onCancel }: { onSaved: (me: unknown) => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image offset in px within the window
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  // Base scale makes the image cover the window; zoom multiplies it.
  const base = nat ? VIEW / Math.min(nat.w, nat.h) : 1;
  const scale = base * zoom;
  const dispW = nat ? nat.w * scale : VIEW;
  const dispH = nat ? nat.h * scale : VIEW;
  const clampPos = (p: { x: number; y: number }, w = dispW, h = dispH) => ({ x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) });

  const choose = (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr("Use a JPG, PNG or WebP image.");
    if (f.size > MAX_BYTES) return setErr("Images must be 5 MB or smaller.");
    const u = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 32 || img.naturalHeight < 32) {
        URL.revokeObjectURL(u);
        return setErr("Images must be at least 32×32 pixels.");
      }
      const b = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setPos({ x: (VIEW - img.naturalWidth * b) / 2, y: (VIEW - img.naturalHeight * b) / 2 });
      setFile(f);
      setUrl(u);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      setErr("That image couldn't be read. Try another file.");
    };
    img.src = u;
  };

  const setZoomKeepCentre = (z: number) => {
    if (!nat) return;
    const cx = (VIEW / 2 - pos.x) / scale;
    const cy = (VIEW / 2 - pos.y) / scale;
    const ns = base * z;
    setZoom(z);
    setPos(clampPos({ x: VIEW / 2 - cx * ns, y: VIEW / 2 - cy * ns }, nat.w * ns, nat.h * ns));
  };

  const save = async () => {
    if (!file || !nat) return;
    setBusy(true);
    setErr(null);
    // Crop square in the original image's own pixels, as fractions.
    const size = VIEW / scale;
    const crop = { x: -pos.x / scale / nat.w, y: -pos.y / scale / nat.h, size: size / Math.min(nat.w, nat.h) };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("crop", JSON.stringify(crop));
    try {
      const res = await fetch("/api/me/avatar", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; me?: unknown };
      if (!res.ok || data.error) throw new Error(data.error ?? "Upload failed.");
      onSaved(data.me);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {!url ? (
        <button
          type="button"
          className="flex h-[260px] w-[260px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-ink-300 transition hover:border-white/30 hover:text-white"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
        >
          <span className="text-sm font-semibold">Choose a photo</span>
          <span className="text-xs text-ink-400">JPG, PNG or WebP · up to 5 MB</span>
        </button>
      ) : (
        <div
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-black select-none active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setPos(clampPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }));
          }}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => setZoomKeepCentre(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
          role="img"
          aria-label="Crop preview. Drag to reposition; use the slider to zoom."
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: dispW, height: dispH, left: pos.x, top: pos.y }} />
          {/* circular mask so you see exactly what others will see */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]" style={{ borderRadius: "50%" }} />
          <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0])} data-testid="avatar-file" />
      {url && (
        <label className="flex w-[260px] items-center gap-3 text-sm text-ink-300">
          <span>Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomKeepCentre(Number(e.target.value))} className="flex-1 accent-brand-500" aria-label="Zoom" />
        </label>
      )}
      {err && (
        <p className="text-sm text-bad-400" role="alert">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        {url && (
          <button type="button" className="btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
            Choose another
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={!url || busy}>
          {busy ? "Saving…" : "Save photo"}
        </button>
      </div>
    </div>
  );
}
