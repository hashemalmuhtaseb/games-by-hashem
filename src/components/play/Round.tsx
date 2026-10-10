"use client";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Action, MediaRef, OptionPublic, PointsBreakdown, PublicRound, RevealPayload, SuggestSet } from "@/engine/types";
import { play } from "@/client/sound";
import { MediaView } from "./Media";

export interface ActResponse {
  error?: string;
  feedback?: Record<string, unknown>;
  reveal?: Record<string, unknown>;
  done: boolean;
  correct?: boolean;
  points?: number;
  breakdown?: PointsBreakdown;
  answer?: RevealPayload;
  timedOut?: boolean;
}

export interface Resume {
  done?: boolean;
  points?: number;
  correct?: boolean;
  clues?: string[];
  stage?: MediaRef;
  reveal?: { prompt?: string; options?: OptionPublic[] };
  found?: unknown[];
  guesses?: unknown[];
}

interface Ctl {
  round: PublicRound;
  act: (a: Action) => Promise<ActResponse | null>;
  locked: boolean;
  reveal: RevealPayload | null;
  resume: Resume | null;
  busy: boolean;
  /** Risk & Reward: the player's live chip balance. */
  balance?: number;
}

// ───────────────────────── shared bits ─────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "bad" | "good" | "info"; id: number } | null>(null);
  const show = useCallback((text: string, tone: "bad" | "good" | "info" = "info") => setMsg({ text, tone, id: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = (
    <div className="pointer-events-none h-7 text-center">
      <AnimatePresence mode="wait">
        {msg && (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`text-sm font-semibold ${msg.tone === "bad" ? "text-bad-400" : msg.tone === "good" ? "text-good-400" : "text-ink-300"}`}>
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  return { show, node };
}

function OptionButton({ o, i, state, onClick, disabled }: { o: OptionPublic; i: number; state: "idle" | "picked" | "right" | "wrong" | "missed"; onClick: () => void; disabled: boolean }) {
  const styles = {
    idle: "border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-brand-400/50",
    picked: "border-brand-400 bg-brand-500/20",
    right: "border-good-400 bg-good-500/20 text-white",
    wrong: "border-bad-400 bg-bad-500/20 animate-shake",
    missed: "border-good-400/70 bg-good-500/10",
  }[state];
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-semibold transition-colors disabled:cursor-default ${styles}`}
    >
      <kbd className="hidden h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-xs text-ink-300 sm:grid">{i + 1}</kbd>
      {o.media && (
        <span className="shrink-0">
          <MediaView m={o.media} size="sm" />
        </span>
      )}
      <span className="flex-1">
        <span className="block text-base leading-snug text-white sm:text-lg">{o.label}</span>
        {o.sub && <span className="block text-xs font-medium text-ink-400">{o.sub}</span>}
      </span>
      {state === "right" && <span className="text-xl">✅</span>}
      {state === "wrong" && <span className="text-xl">❌</span>}
    </motion.button>
  );
}

function OptionGrid({ options, onPick, picked, correctId, locked, wrongIds }: { options: OptionPublic[]; onPick: (id: string) => void; picked: string | null; correctId?: string; locked: boolean; wrongIds?: string[] }) {
  useEffect(() => {
    if (locked) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(options[n - 1].id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [options, onPick, locked]);
  return (
    <div className={`grid w-full gap-3 ${options.length > 4 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {options.map((o, i) => {
        let st: "idle" | "picked" | "right" | "wrong" | "missed" = "idle";
        if (correctId) {
          if (o.id === correctId) st = picked === o.id ? "right" : "missed";
          else if (picked === o.id) st = "wrong";
        } else if (wrongIds?.includes(o.id)) st = "wrong";
        else if (picked === o.id) st = "picked";
        return <OptionButton key={o.id} o={o} i={i} state={st} disabled={locked || !!wrongIds?.includes(o.id)} onClick={() => onPick(o.id)} />;
      })}
    </div>
  );
}

const suggestCache = new Map<string, Promise<string[]>>();
function useSuggestNames(set?: SuggestSet): string[] | undefined {
  const [names, setNames] = useState<string[]>();
  useEffect(() => {
    if (!set) return;
    if (!suggestCache.has(set))
      suggestCache.set(
        set,
        fetch(`/api/suggest/${set}`)
          .then((r) => r.json() as Promise<{ names?: string[] }>)
          .then((d) => d.names ?? [])
          .catch(() => {
            suggestCache.delete(set);
            return [];
          }),
      );
    let live = true;
    void suggestCache.get(set)!.then((n) => live && setNames(n));
    return () => {
      live = false;
    };
  }, [set]);
  return names;
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Names whose full text or any word starts with what was typed; full-name matches first. */
function matchNames(names: string[], q: string, max = 8): string[] {
  const t = fold(q.trim());
  if (!t) return [];
  const starts: string[] = [];
  const words: string[] = [];
  for (const n of names) {
    const f = fold(n);
    if (f === t) continue;
    if (f.startsWith(t)) starts.push(n);
    else if (f.split(/[\s.'-]+/).some((w) => w.startsWith(t))) words.push(n);
    if (starts.length >= max) break;
  }
  return [...starts, ...words].slice(0, max);
}

function TextAnswer({ placeholder, onSubmit, disabled, shake, autoFocus = true, suggestions, suggestSet }: { placeholder?: string; onSubmit: (v: string) => void; disabled: boolean; shake?: number; autoFocus?: boolean; suggestions?: string[]; suggestSet?: SuggestSet }) {
  const [v, setV] = useState("");
  const [hi, setHi] = useState(-1);
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLInputElement>(null);
  const fetched = useSuggestNames(suggestions ? undefined : suggestSet);
  const pool = suggestions ?? fetched;
  const matches = useMemo(() => (pool && open ? matchNames(pool, v) : []), [pool, v, open]);
  // Ready to type: focus on mount, after every wrong guess (the form remounts) and when re-enabled.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled, shake]);
  // Typing anywhere on the page goes into the answer box, so you never have to click it.
  useEffect(() => {
    if (disabled) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      ref.current?.focus();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [disabled]);
  const submit = (value: string) => {
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setV("");
    setHi(-1);
    requestAnimationFrame(() => ref.current?.focus());
  };
  return (
    <form
      className={`relative flex w-full max-w-xl gap-2 ${shake ? "animate-shake" : ""}`}
      key={shake}
      onSubmit={(e) => {
        e.preventDefault();
        submit(hi >= 0 && matches[hi] ? matches[hi] : v);
      }}
    >
      <input
        ref={ref}
        className="input text-lg"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setHi(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((i) => (i <= 0 ? matches.length - 1 : i - 1));
          } else if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            setV(matches[hi >= 0 ? hi : 0]);
            setHi(-1);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? "Type your answer…"}
        disabled={disabled}
        maxLength={80}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-autocomplete="list"
      />
      <button className="btn-primary px-6" disabled={disabled || !v.trim()}>
        Go
      </button>
      {matches.length > 0 && !disabled && (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur">
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === hi}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => submit(m)}
                className={`block w-full px-4 py-2.5 text-left text-base transition ${i === hi ? "bg-brand-500/25 text-white" : "text-ink-100 hover:bg-white/5"}`}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

// ───────────────────────── kinds ─────────────────────────

type QReveal = { prompt?: string; options?: OptionPublic[]; media?: MediaRef };

function ChoiceKind({ round, act, locked, reveal, resume }: Ctl) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = locked || !!picked || !!resume?.done;
  return (
    <OptionGrid
      options={round.options ?? []}
      picked={picked}
      correctId={reveal?.correctOptionId}
      locked={done}
      onPick={async (id) => {
        if (done) return;
        setPicked(id);
        play("click");
        const r = await act({ type: "answer", value: id });
        if (r?.error) setPicked(null);
      }}
    />
  );
}

function TextKind({ round, act, locked, resume }: Ctl) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const done = locked || !!resume?.done;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <TextAnswer
        placeholder={round.input?.placeholder}
        suggestSet={round.input?.suggest}
        disabled={done}
        shake={shake}
        onSubmit={async (v) => {
          const r = await act({ type: "answer", value: v });
          if (!r || r.error) return;
          const f = r.feedback as { correct?: boolean; attemptsLeft?: number } | undefined;
          if (f && !f.correct) {
            setWrong((w) => [...w, v]);
            setShake((s) => s + 1);
            play("wrong");
            if (f.attemptsLeft) toast.show(`Not quite — ${f.attemptsLeft} ${f.attemptsLeft === 1 ? "try" : "tries"} left`, "bad");
          }
        }}
      />
      {toast.node}
      {wrong.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.map((w, i) => (
            <span key={i} className="chip border-bad-500/30 text-bad-400 line-through">
              {w}
            </span>
          ))}
        </div>
      )}
      {!done && (
        <button className="text-sm text-ink-400 hover:text-white" onClick={() => act({ type: "give-up" })}>
          I don&apos;t know — skip
        </button>
      )}
    </div>
  );
}

function NumberKind({ round, act, locked, resume }: Ctl) {
  const spec = round.input?.numeric ?? { min: 0, max: 100, step: 1 };
  const toSlider = (n: number) => (spec.log ? (Math.log(Math.max(n, spec.min || 1)) - Math.log(spec.min || 1)) / (Math.log(spec.max) - Math.log(spec.min || 1)) : (n - spec.min) / (spec.max - spec.min));
  const fromSlider = (t: number) => {
    const raw = spec.log ? Math.exp(Math.log(spec.min || 1) + t * (Math.log(spec.max) - Math.log(spec.min || 1))) : spec.min + t * (spec.max - spec.min);
    const step = spec.step || 1;
    return Math.round(raw / step) * step;
  };
  const [val, setVal] = useState(() => fromSlider(0.5));
  const [text, setText] = useState(String(fromSlider(0.5)));
  const done = locked || !!resume?.done;
  return (
    <form
      className="flex w-full max-w-xl flex-col items-center gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (done) return;
        play("click");
        await act({ type: "answer", value: val });
      }}
    >
      <div className="display text-5xl font-bold text-white tabular-nums">
        {val.toLocaleString()}
        {spec.unit && <span className="ml-2 text-2xl text-ink-400">{spec.unit}</span>}
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(toSlider(val) * 1000)}
        disabled={done}
        onChange={(e) => {
          const n = fromSlider(Number(e.target.value) / 1000);
          setVal(n);
          setText(String(n));
        }}
        className="h-3 w-full cursor-pointer accent-brand-500"
      />
      <div className="flex w-full justify-between text-xs text-ink-400">
        <span>{spec.min.toLocaleString()}</span>
        <span>{spec.max.toLocaleString()}</span>
      </div>
      <div className="flex w-full gap-2">
        <input
          className="input text-center text-lg tabular-nums"
          inputMode="numeric"
          value={text}
          disabled={done}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(/[, ]/g, ""));
            if (Number.isFinite(n) && n >= spec.min && n <= spec.max) setVal(n);
          }}
        />
        <button className="btn-primary px-8" disabled={done}>
          Lock in
        </button>
      </div>
    </form>
  );
}

function CluesKind({ round, act, locked, resume }: Ctl) {
  const [clues, setClues] = useState<string[]>(() => resume?.clues ?? ((round.extra?.clues as string[]) ?? []));
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const total = round.totalClues ?? clues.length;
  const done = locked || !!resume?.done;
  const handle = (r: ActResponse | null) => {
    if (!r || r.error) return;
    if (r.reveal?.clue) {
      setClues((c) => [...c, r.reveal!.clue as string]);
      play("hint");
    }
    const f = r.feedback as { correct?: boolean; attemptsLeft?: number } | undefined;
    if (f && f.correct === false) {
      setShake((s) => s + 1);
      play("wrong");
      if (f.attemptsLeft) toast.show(`Wrong — here's another clue (${f.attemptsLeft} ${f.attemptsLeft === 1 ? "guess" : "guesses"} left)`, "bad");
    }
  };
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ol className="w-full max-w-xl space-y-2">
        <AnimatePresence initial={false}>
          {clues.map((c, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/30 text-xs font-bold text-brand-400">{i + 1}</span>
              <span className={`font-medium whitespace-pre-line text-white ${/_ /.test(c) ? "font-mono tracking-wider" : ""}`}>{c}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="flex items-center gap-3 text-sm text-ink-400">
        <span>
          Clue {clues.length} of {total}
        </span>
        {!done && clues.length < total && (
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={async () => handle(await act({ type: "hint" }))}>
            💡 Next clue (−points)
          </button>
        )}
      </div>
      {round.options ? (
        <OptionGrid
          options={round.options}
          picked={picked}
          locked={done}
          wrongIds={wrongIds}
          onPick={async (id) => {
            setPicked(id);
            const r = await act({ type: "answer", value: id });
            if (r?.feedback && (r.feedback as { correct?: boolean }).correct === false) setWrongIds((w) => [...w, id]);
            handle(r);
          }}
        />
      ) : (
        <TextAnswer placeholder={round.input?.placeholder} suggestSet={round.input?.suggest} disabled={done} shake={shake} onSubmit={async (v) => handle(await act({ type: "answer", value: v }))} />
      )}
      {toast.node}
      {!done && (
        <button className="text-sm text-ink-400 hover:text-white" onClick={() => act({ type: "give-up" })}>
          Give up
        </button>
      )}
    </div>
  );
}

function RevealKind(ctl: Ctl & { setStage: (m: MediaRef) => void }) {
  const { round, act, locked, resume, reveal } = ctl;
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const total = round.totalClues ?? 1;
  const done = locked || !!resume?.done;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-3 text-sm text-ink-400">
        <span>
          Reveal {step} of {total}
        </span>
        {!done && step < total && (
          <button
            className="btn-ghost px-3 py-1.5 text-sm"
            onClick={async () => {
              const r = await act({ type: "hint" });
              if (r?.reveal?.media) {
                ctl.setStage(r.reveal.media as MediaRef);
                setStep((s) => s + 1);
                play("hint");
              }
            }}
          >
            🔍 Reveal more (−points)
          </button>
        )}
      </div>
      {round.options ? (
        <OptionGrid
          options={round.options}
          picked={picked}
          correctId={reveal?.correctOptionId}
          locked={done || !!picked}
          onPick={async (id) => {
            setPicked(id);
            await act({ type: "answer", value: id });
          }}
        />
      ) : (
        <TextAnswer
          placeholder={round.input?.placeholder}
          disabled={done}
          shake={shake}
          onSubmit={async (v) => {
            const r = await act({ type: "answer", value: v });
            const f = r?.feedback as { correct?: boolean; attemptsLeft?: number } | undefined;
            if (f && f.correct === false) {
              setShake((s) => s + 1);
              play("wrong");
              if (f.attemptsLeft) toast.show(`Nope — ${f.attemptsLeft} left`, "bad");
            }
          }}
        />
      )}
      {toast.node}
    </div>
  );
}

function OrderKind({ round, act, locked, reveal, resume }: Ctl) {
  const [items, setItems] = useState<OptionPublic[]>(round.options ?? []);
  const ends = (round.extra?.ends as [string, string]) ?? ["Top", "Bottom"];
  const matchMedia = !!round.extra?.matchMedia;
  const done = locked || !!resume?.done;
  const [submitted, setSubmitted] = useState(false);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    setItems(n);
    play("click");
  };
  const correctAt = (id: string, i: number) => reveal?.order && reveal.order[i] === id;
  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      {!matchMedia && <div className="label text-center">▲ {ends[0]}</div>}
      <div className="flex gap-3">
        {matchMedia && (
          <div className="flex flex-col gap-2">
            {(round.media ?? []).map((m, i) => (
              <div key={i} className="flex h-16 items-center">
                <MediaView m={m} size="sm" />
              </div>
            ))}
          </div>
        )}
        <Reorder.Group axis="y" values={items} onReorder={done || submitted ? () => {} : setItems} className="flex flex-1 flex-col gap-2">
          {items.map((o, i) => (
            <Reorder.Item
              key={o.id}
              value={o}
              dragListener={!(done || submitted)}
              className={`flex h-16 cursor-grab items-center gap-3 rounded-xl border-2 px-3 active:cursor-grabbing ${reveal ? (correctAt(o.id, i) ? "border-good-400 bg-good-500/15" : "border-bad-400 bg-bad-500/15") : "border-white/10 bg-white/[0.05]"}`}
            >
              <span className="text-ink-400">⠿</span>
              {o.media && <MediaView m={o.media} size="sm" />}
              <span className="flex-1 font-semibold text-white">
                {o.label}
                {o.sub && <span className="block text-xs text-ink-400">{o.sub}</span>}
              </span>
              {!(done || submitted) && (
                <span className="flex flex-col">
                  <button aria-label="Move up" className="px-2 text-ink-400 hover:text-white" onClick={() => move(i, -1)}>
                    ▲
                  </button>
                  <button aria-label="Move down" className="px-2 text-ink-400 hover:text-white" onClick={() => move(i, 1)}>
                    ▼
                  </button>
                </span>
              )}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
      {!matchMedia && <div className="label text-center">▼ {ends[1]}</div>}
      {!done && !submitted && (
        <button
          className="btn-primary"
          onClick={async () => {
            setSubmitted(true);
            const r = await act({ type: "answer", value: items.map((x) => x.id) });
            if (r?.error) setSubmitted(false);
          }}
        >
          Lock in order
        </button>
      )}
    </div>
  );
}

const GROUP_COLORS = ["bg-yellow-400/90 text-ink-950", "bg-green-400/90 text-ink-950", "bg-sky-400/90 text-ink-950", "bg-purple-400/90 text-ink-950"];

function GroupsKind({ round, act, locked, reveal, resume }: Ctl) {
  type G = { label: string; ids: string[]; level: number };
  const [found, setFound] = useState<G[]>(() => (resume?.found as G[]) ?? []);
  const [sel, setSel] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [order, setOrder] = useState<OptionPublic[]>(round.options ?? []);
  const toast = useToast();
  const done = locked || !!resume?.done;
  const byId = useMemo(() => new Map((round.options ?? []).map((o) => [o.id, o])), [round.options]);
  const shown: G[] = reveal?.groups ? [...found, ...reveal.groups.filter((g) => !found.some((f) => f.label === g.label))] : found;
  const remaining = order.filter((o) => !shown.some((g) => g.ids.includes(o.id)));
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {shown.map((g) => (
        <motion.div key={g.label} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-xl px-4 py-3 text-center ${GROUP_COLORS[g.level % 4]}`}>
          <div className="text-sm font-black tracking-wide uppercase">{g.label}</div>
          <div className="text-sm font-medium">{g.ids.map((id) => byId.get(id)?.label).join(" · ")}</div>
        </motion.div>
      ))}
      <div className="grid grid-cols-4 gap-2">
        {remaining.map((o) => {
          const on = sel.includes(o.id);
          return (
            <motion.button
              layout
              key={o.id}
              disabled={done}
              onClick={() => {
                play("click");
                setSel((s) => (on ? s.filter((x) => x !== o.id) : s.length < 4 ? [...s, o.id] : s));
              }}
              className={`min-h-16 rounded-xl px-1 text-center text-xs font-bold uppercase transition sm:text-sm ${on ? "bg-ink-100 text-ink-950" : "bg-white/[0.08] text-white hover:bg-white/[0.14]"}`}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
      {toast.node}
      {!done && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-sm text-ink-400">
            Mistakes left:
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i < 4 - mistakes ? "bg-ink-300" : "bg-ink-700"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setOrder((o) => [...o].sort(() => Math.random() - 0.5))}>
              Shuffle
            </button>
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setSel([])} disabled={!sel.length}>
              Clear
            </button>
            <button
              className="btn-primary px-4 py-1.5 text-sm"
              disabled={sel.length !== 4}
              onClick={async () => {
                const r = await act({ type: "answer", value: sel });
                const f = r?.feedback as { correct?: boolean; group?: G; oneAway?: boolean; mistakes?: number } | undefined;
                if (!f) return;
                if (f.correct && f.group) {
                  setFound((x) => [...x, f.group!]);
                  setSel([]);
                  play("correct");
                } else {
                  setMistakes(f.mistakes ?? mistakes + 1);
                  play("wrong");
                  toast.show(f.oneAway ? "One away…" : "Not a group", "bad");
                }
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiKind({ round, act, locked, resume }: Ctl) {
  const [found, setFound] = useState<string[]>(() => (resume?.found as string[]) ?? []);
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const target = round.input?.target ?? 5;
  const done = locked || !!resume?.done;
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div className="flex gap-2">
        {Array.from({ length: target }, (_, i) => (
          <motion.div key={i} animate={{ scale: found[i] ? [1, 1.15, 1] : 1 }} className={`h-3 w-10 rounded-full ${found[i] ? "bg-good-400" : "bg-white/10"}`} />
        ))}
      </div>
      <TextAnswer
        placeholder={round.input?.placeholder ?? (round.input?.letter ? `Starts with ${round.input.letter}…` : "Type an answer…")}
        disabled={done}
        shake={shake}
        onSubmit={async (v) => {
          const r = await act({ type: "answer", value: v });
          const f = r?.feedback as { accepted?: boolean; canonical?: string; reason?: string } | undefined;
          if (!f) return;
          if (f.accepted) {
            setFound((x) => [...x, f.canonical ?? v]);
            play("pop");
          } else {
            setShake((s) => s + 1);
            play("wrong");
            toast.show(f.reason === "already counted" ? "Already got that one" : "Not recognised", "bad");
          }
        }}
      />
      {toast.node}
      <div className="flex flex-wrap justify-center gap-2">
        {found.map((f) => (
          <motion.span key={f} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="chip border-good-500/40 bg-good-500/10 px-3 py-1 text-sm text-good-400">
            ✓ {f}
          </motion.span>
        ))}
      </div>
      {!done && found.length > 0 && found.length < target && (
        <button className="text-sm text-ink-400 hover:text-white" onClick={() => act({ type: "finish" })}>
          That&apos;s all I&apos;ve got — finish
        </button>
      )}
    </div>
  );
}

function RareKind({ round, act, locked, resume }: Ctl) {
  const [res, setRes] = useState<{ valid: boolean; canonical?: string; rarityPoints?: number; percent?: number } | null>(null);
  const done = locked || !!resume?.done || !!res;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <TextAnswer
        placeholder={round.input?.placeholder ?? (round.input?.letter ? `Something starting with ${round.input.letter}…` : "The rarer the better…")}
        disabled={done}
        onSubmit={async (v) => {
          const r = await act({ type: "answer", value: v });
          if (r?.feedback) setRes(r.feedback as typeof res);
        }}
      />
      {res && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          {res.valid ? (
            <>
              <div className="text-sm text-ink-400">{res.canonical}</div>
              <div className="display text-5xl font-black text-white">{res.rarityPoints} <span className="text-2xl text-brand-400">rarity</span></div>
              {res.percent !== undefined && <div className="text-sm text-ink-300">≈ {res.percent}% of players would say this</div>}
            </>
          ) : (
            <div className="display text-2xl font-bold text-bad-400">Not a valid answer (−10)</div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function SortKind({ round, act, locked, resume }: Ctl) {
  const buckets = round.buckets ?? ["A", "B"];
  const [assign, setAssign] = useState<Record<string, 0 | 1>>({});
  const [sent, setSent] = useState(false);
  const done = locked || !!resume?.done || sent;
  const opts = round.options ?? [];
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {opts.map((o) => (
        <div key={o.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <span className="flex-1 px-2 font-semibold text-white">{o.label}</span>
          {buckets.map((b, bi) => (
            <button
              key={b}
              disabled={done}
              onClick={() => {
                play("click");
                setAssign((a) => ({ ...a, [o.id]: bi as 0 | 1 }));
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${assign[o.id] === bi ? (bi === 0 ? "bg-cyan-500 text-ink-950" : "bg-hot-500 text-white") : "bg-white/[0.06] text-ink-300 hover:bg-white/10"}`}
            >
              {b}
            </button>
          ))}
        </div>
      ))}
      {!done && (
        <button
          className="btn-primary mt-2"
          disabled={Object.keys(assign).length !== opts.length}
          onClick={async () => {
            setSent(true);
            const r = await act({ type: "answer", value: assign });
            if (r?.error) setSent(false);
          }}
        >
          Submit
        </button>
      )}
    </div>
  );
}

const ARROWS: Record<string, string> = { N: "⬆️", NE: "↗️", E: "➡️", SE: "↘️", S: "⬇️", SW: "↙️", W: "⬅️", NW: "↖️", "🎯": "🎯" };

function MapKind({ round, act, locked, resume }: Ctl) {
  type Guess = { name: string; km: number; dir: string; pct: number };
  const [guesses, setGuesses] = useState<Guess[]>(() => (resume?.guesses as Guess[]) ?? []);
  const toast = useToast();
  const done = locked || !!resume?.done;
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <TextAnswer
        placeholder="Guess a country…"
        disabled={done}
        suggestions={round.extra?.choices as string[] | undefined}
        onSubmit={async (v) => {
          const r = await act({ type: "answer", value: v });
          const f = r?.feedback as { unknown?: boolean; duplicate?: boolean; guess?: Guess; correct?: boolean } | undefined;
          if (!f) return;
          if (f.unknown) return toast.show("Unknown country", "bad");
          if (f.duplicate) return toast.show("Already guessed", "bad");
          if (f.guess) {
            setGuesses((g) => [...g, f.guess!]);
            play(f.correct ? "correct" : "tick");
          }
        }}
      />
      {toast.node}
      <div className="w-full space-y-1.5">
        {guesses.map((g, i) => (
          <motion.div key={g.name} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2">
            <span className="font-semibold text-white">
              {i + 1}. {g.name}
            </span>
            <span className="tabular-nums text-ink-300">{g.km.toLocaleString()} km</span>
            <span className="text-xl">{ARROWS[g.dir] ?? g.dir}</span>
            <span className="w-12 text-right font-bold tabular-nums text-brand-400">{g.pct}%</span>
          </motion.div>
        ))}
        {Array.from({ length: Math.max(0, 6 - guesses.length) }, (_, i) => (
          <div key={i} className="h-10 rounded-xl border border-dashed border-white/10" />
        ))}
      </div>
      {!done && (
        <button className="text-sm text-ink-400 hover:text-white" onClick={() => act({ type: "give-up" })}>
          Give up
        </button>
      )}
    </div>
  );
}

type Odds = { num: number; den: number; label: string };

function WagerKind({ round, act, locked, resume, reveal, balance }: Ctl) {
  const odds = (round.extra?.odds as Odds | undefined) ?? { num: 1, den: 1, label: "Evens (1/1)" };
  const bal = Math.max(0, Math.floor(balance ?? 0));
  const initial = Math.max(1, Math.min(bal, Math.round(bal / 10)));
  const [stake, setStake] = useState(initial);
  const [text, setText] = useState(String(initial));
  const [confirming, setConfirming] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState<QReveal | null>(resume?.reveal ?? null);
  const [picked, setPicked] = useState<string | null>(null);
  const done = locked || !!resume?.done;
  const profit = Math.floor((stake * odds.num) / odds.den);
  const valid = Number.isInteger(stake) && stake >= 1 && stake <= bal;
  const set = (n: number) => {
    const v = Math.max(0, Math.min(bal, Math.floor(n)));
    setStake(v);
    setText(String(v));
    setConfirming(false);
    setErr(null);
  };
  const shownStake = placed ?? stake;
  const shownProfit = Math.floor((shownStake * odds.num) / odds.den);
  const summary = (
    <div className="grid w-full grid-cols-3 gap-2 text-center" aria-live="polite">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2">
        <div className="label">Balance</div>
        <div className="display text-xl font-bold text-white tabular-nums">{bal.toLocaleString()}</div>
      </div>
      <div className="rounded-xl border border-good-500/30 bg-good-500/10 px-2 py-2">
        <div className="label">If right</div>
        <div className="display text-xl font-bold text-good-400 tabular-nums">+{shownProfit.toLocaleString()}</div>
        <div className="text-[11px] text-ink-400">pays {(shownStake + shownProfit).toLocaleString()} back</div>
      </div>
      <div className="rounded-xl border border-bad-500/30 bg-bad-500/10 px-2 py-2">
        <div className="label">If wrong</div>
        <div className="display text-xl font-bold text-bad-400 tabular-nums">−{shownStake.toLocaleString()}</div>
        <div className="text-[11px] text-ink-400">leaves {Math.max(0, bal - shownStake).toLocaleString()}</div>
      </div>
    </div>
  );
  if (bal <= 0 && !q) return <div className="card max-w-md p-5 text-center text-ink-300">You&apos;re out of chips, so you&apos;re watching from here.</div>;
  if (!q)
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-ink-300">
          <span className="chip border-warn-400/40 text-warn-400">Odds {odds.label}</span>
          <span>Virtual chips only</span>
        </div>
        {summary}
        <label className="flex w-full flex-col gap-1">
          <span className="label">Your stake</span>
          <input
            className="input text-center text-3xl font-bold tabular-nums"
            inputMode="numeric"
            value={text}
            disabled={done || confirming}
            aria-invalid={!valid}
            onChange={(e) => {
              const t = e.target.value.replace(/[^0-9]/g, "").slice(0, 9);
              setText(t);
              setStake(t ? Number(t) : 0);
              setConfirming(false);
              setErr(null);
            }}
          />
        </label>
        <input
          type="range"
          min={1}
          max={Math.max(1, bal)}
          step={1}
          value={Math.min(Math.max(stake, 1), Math.max(1, bal))}
          onChange={(e) => set(Number(e.target.value))}
          className="w-full accent-amber-400"
          disabled={done || confirming}
          aria-label="Stake"
        />
        <div className="grid w-full grid-cols-4 gap-2">
          {[0.1, 0.25, 0.5].map((f) => (
            <button key={f} type="button" className="btn-ghost px-2 py-2 text-sm" disabled={done || confirming} onClick={() => set(Math.max(1, Math.floor(bal * f)))}>
              {f * 100}%
            </button>
          ))}
          <button type="button" className="btn-danger px-2 py-2 text-sm" disabled={done || confirming} onClick={() => set(bal)}>
            All-in
          </button>
        </div>
        {!valid && <div className="text-sm text-bad-400">{stake > bal ? `You only have ${bal.toLocaleString()} chips.` : "Stake at least 1 chip."}</div>}
        {err && <div className="text-sm text-bad-400">{err}</div>}
        {!confirming ? (
          <button className="btn-primary w-full py-3" disabled={done || !valid} onClick={() => setConfirming(true)}>
            Review stake
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2 rounded-2xl border border-warn-400/40 bg-warn-400/10 p-3 text-center">
            <div className="text-sm text-ink-100">
              Stake <b className="text-white">{stake.toLocaleString()}</b> chips{stake === bal ? " (all-in)" : ""}? Right pays <b className="text-good-400">+{profit.toLocaleString()}</b>, wrong costs{" "}
              <b className="text-bad-400">{stake.toLocaleString()}</b>
              {stake === bal ? " and eliminates you" : ""}. You can&apos;t change it after this.
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirming(false)}>
                Change
              </button>
              <button
                className="btn-primary flex-1"
                disabled={done || placed !== null}
                onClick={async () => {
                  setPlaced(stake);
                  const r = await act({ type: "bet", value: stake });
                  if (!r || r.error) {
                    setPlaced(null);
                    setConfirming(false);
                    setErr(r?.error ?? "Couldn't place that stake.");
                    return;
                  }
                  if (r.reveal) setQ(r.reveal as QReveal);
                  play("start");
                }}
              >
                Confirm stake
              </button>
            </div>
          </div>
        )}
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full max-w-md">{summary}</div>
      <div className="text-sm text-ink-400">Stake locked: {shownStake.toLocaleString()} chips</div>
      {q.prompt && <div className="display text-center text-xl font-bold text-white">{q.prompt}</div>}
      {q.media && <MediaView m={q.media} />}
      <OptionGrid
        options={q.options ?? []}
        picked={picked}
        correctId={reveal?.correctOptionId}
        locked={done || !!picked}
        onPick={async (id) => {
          setPicked(id);
          await act({ type: "answer", value: id });
        }}
      />
    </div>
  );
}

function ChainKind({ round, act, locked, resume }: Ctl) {
  const start = (round.extra?.start as string) ?? "";
  const [words, setWords] = useState<{ w: string; by: "you" | "bot" }[]>([{ w: start, by: "bot" }]);
  const [score, setScore] = useState(0);
  const [minLen, setMinLen] = useState((round.extra?.minLen as number) ?? 3);
  const [turnSec, setTurnSec] = useState((round.extra?.turnSec as number) ?? 12);
  const [turnStart, setTurnStart] = useState(Date.now());
  const [left, setLeft] = useState(turnSec);
  const [shake, setShake] = useState(0);
  const toast = useToast();
  const [over, setOver] = useState(false);
  const done = locked || !!resume?.done || over;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [words]);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setLeft(Math.max(0, turnSec - (Date.now() - turnStart) / 1000)), 200);
    return () => clearInterval(t);
  }, [turnStart, turnSec, done]);
  const last = words[words.length - 1]?.w ?? "";
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="chip">Min {minLen} letters</span>
        <span className="display text-2xl font-bold text-white tabular-nums">{score} pts</span>
        <span className={`chip tabular-nums ${left < 4 ? "border-bad-500/50 text-bad-400" : ""}`}>⏱ {left.toFixed(0)}s</span>
      </div>
      <div ref={scroller} className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-ink-900/60 p-3">
        {words.map((x, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[80%] rounded-2xl px-3 py-1.5 font-semibold ${x.by === "you" ? "self-end bg-brand-500/30 text-white" : "self-start bg-white/[0.07] text-ink-100"}`}>
            {x.w}
          </motion.div>
        ))}
      </div>
      <div className="text-center text-sm text-ink-300">
        Next word must start with <b className="text-xl text-white uppercase">{last.slice(-1)}</b>
      </div>
      <TextAnswer
        placeholder={`${last.slice(-1).toUpperCase()}…`}
        disabled={done}
        shake={shake}
        onSubmit={async (v) => {
          const r = await act({ type: "answer", value: v });
          const f = r?.feedback as { accepted?: boolean; reason?: string; bot?: string; score?: number; turnSec?: number; minLen?: number; botGaveUp?: boolean } | undefined;
          if (!f) return;
          if (!f.accepted) {
            setShake((s) => s + 1);
            play("wrong");
            toast.show(`Out: ${f.reason}`, "bad");
            setOver(true);
            return;
          }
          play("pop");
          setWords((w) => [...w, { w: v.toLowerCase(), by: "you" }, ...(f.bot ? [{ w: f.bot, by: "bot" as const }] : [])]);
          if (f.score !== undefined) setScore(f.score);
          if (f.turnSec) setTurnSec(f.turnSec);
          if (f.minLen) setMinLen(f.minLen);
          setTurnStart(Date.now());
          if (f.botGaveUp) {
            toast.show("The bot is stumped! +50", "good");
            setOver(true);
          }
        }}
      />
      {toast.node}
    </div>
  );
}

function MemoryKind({ round, act, locked, resume, reveal }: Ctl) {
  const study = (round.extra?.study as MediaRef[]) ?? [];
  const studySeconds = (round.extra?.studySeconds as number) ?? 6;
  const [q, setQ] = useState<{ prompt?: string; options?: OptionPublic[] } | null>(resume?.reveal ?? null);
  const [picked, setPicked] = useState<string | null>(null);
  const [left, setLeft] = useState(studySeconds);
  const done = locked || !!resume?.done;
  const ready = useCallback(async () => {
    const r = await act({ type: "ready" });
    if (r?.reveal) setQ(r.reveal as QReveal);
  }, [act]);
  useEffect(() => {
    if (q || done) return;
    const t0 = Date.now();
    const t = setInterval(() => {
      const l = studySeconds - (Date.now() - t0) / 1000;
      setLeft(Math.max(0, l));
      if (l <= 0) {
        clearInterval(t);
        void ready();
      }
    }, 100);
    return () => clearInterval(t);
  }, [q, done, studySeconds, ready]);
  if (!q && !reveal)
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {study.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="grid place-items-center">
              <MediaView m={m} size="md" />
            </motion.div>
          ))}
        </div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-warn-400 transition-[width] duration-100" style={{ width: `${(left / studySeconds) * 100}%` }} />
        </div>
        <button className="btn-ghost" onClick={ready} disabled={done}>
          I&apos;m ready
        </button>
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {q?.prompt && <div className="display text-center text-xl font-bold text-white">{q.prompt}</div>}
      <OptionGrid
        options={q?.options ?? []}
        picked={picked}
        correctId={reveal?.correctOptionId}
        locked={done || !!picked}
        onPick={async (id) => {
          setPicked(id);
          await act({ type: "answer", value: id });
        }}
      />
    </div>
  );
}

function LettersKind({ round, act, locked, resume }: Ctl) {
  const letters = (round.extra?.letters as string[]) ?? [];
  const [word, setWord] = useState("");
  const [res, setRes] = useState<{ valid: boolean; reason?: string; length?: number; best?: number; attemptsLeft?: number } | null>(null);
  const [shake, setShake] = useState(0);
  const done = locked || !!resume?.done || !!res?.valid || res?.attemptsLeft === 0;
  const used = (() => {
    const pool = [...letters];
    const marks = letters.map(() => false);
    for (const ch of word.toUpperCase()) {
      const i = pool.findIndex((x, j) => x === ch && !marks[j]);
      if (i >= 0) marks[i] = true;
    }
    return marks;
  })();
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        {letters.map((l, i) => (
          <motion.button
            key={i}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            disabled={done || used[i]}
            onClick={() => setWord((w) => w + l.toLowerCase())}
            className={`display grid h-14 w-12 place-items-center rounded-xl text-2xl font-black shadow-lg transition ${used[i] ? "bg-white/5 text-ink-600" : "bg-gradient-to-b from-amber-200 to-amber-400 text-ink-950 hover:-translate-y-0.5"}`}
          >
            {l}
          </motion.button>
        ))}
      </div>
      <form
        key={shake}
        className={`flex w-full gap-2 ${shake ? "animate-shake" : ""}`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!word.trim() || done) return;
          const r = await act({ type: "answer", value: word.trim() });
          const f = r?.feedback as typeof res;
          if (!f) return;
          setRes(f);
          if (!f.valid) {
            setShake((s) => s + 1);
            play("wrong");
          } else play("correct");
        }}
      >
        <input className="input text-center font-mono text-2xl tracking-[0.3em] uppercase" value={word} onChange={(e) => setWord(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, letters.length))} disabled={done} placeholder="YOUR WORD" autoFocus />
        <button type="button" className="btn-ghost" onClick={() => setWord("")} disabled={done}>
          ⌫
        </button>
        <button className="btn-primary px-6" disabled={done || word.length < 3}>
          Forge
        </button>
      </form>
      {res && !res.valid && <div className="text-sm font-semibold text-bad-400">✗ {res.reason}{res.attemptsLeft ? ` — ${res.attemptsLeft} ${res.attemptsLeft === 1 ? "try" : "tries"} left` : ""}</div>}
      {res?.valid && (
        <div className="text-center">
          <div className="display text-3xl font-black text-white">{res.length} letters</div>
          <div className="text-sm text-ink-400">Longest possible: {res.best}</div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── timer ─────────────────────────

export function TimerBar({ deadline, offset, total, paused, onZero, stopped }: { deadline: number; offset: number; total: number; paused?: boolean; onZero?: () => void; stopped?: boolean }) {
  const [left, setLeft] = useState(total);
  const fired = useRef(false);
  const lastTick = useRef(-1);
  useEffect(() => {
    fired.current = false;
  }, [deadline]);
  useEffect(() => {
    if (paused || stopped) return;
    let raf = 0;
    const loop = () => {
      // Deadline includes ~1s server grace; show the nominal limit.
      const l = Math.max(0, (deadline - 1000 - (Date.now() + offset)) / 1000);
      setLeft(l);
      const whole = Math.ceil(l);
      if (whole <= 5 && whole > 0 && whole !== lastTick.current) {
        lastTick.current = whole;
        play("tick");
      }
      if (l <= 0 && !fired.current) {
        fired.current = true;
        onZero?.();
      }
      if (l > 0) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deadline, offset, paused, stopped, onZero]);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const color = pct > 50 ? "from-brand-500 to-cyan-400" : pct > 20 ? "from-warn-400 to-orange-500" : "from-bad-500 to-hot-500";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-right font-bold tabular-nums ${pct <= 20 ? "text-bad-400" : "text-ink-300"}`}>{paused ? "⏸" : Math.ceil(left)}</span>
    </div>
  );
}

// ───────────────────────── round shell ─────────────────────────

export function RoundPlayer({
  round,
  act,
  locked,
  reveal,
  resume,
  header,
  balance,
}: {
  round: PublicRound;
  act: (a: Action) => Promise<ActResponse | null>;
  locked: boolean;
  reveal: RevealPayload | null;
  resume: Resume | null;
  header?: ReactNode;
  balance?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<MediaRef | null>(resume?.stage ?? null);
  const wrapped = useCallback(
    async (a: Action) => {
      setBusy(true);
      try {
        return await act(a);
      } finally {
        setBusy(false);
      }
    },
    [act],
  );
  const ctl: Ctl = { round, act: wrapped, locked: locked || !!reveal, reveal, resume, busy, balance };
  const media = round.kind === "order" && round.extra?.matchMedia ? [] : round.kind === "reveal" && stage ? [stage] : round.media ?? [];
  const body = (() => {
    switch (round.kind) {
      case "choice":
        return <ChoiceKind {...ctl} />;
      case "text":
        return <TextKind {...ctl} />;
      case "number":
        return <NumberKind {...ctl} />;
      case "clues":
        return <CluesKind {...ctl} />;
      case "reveal":
        return <RevealKind {...ctl} setStage={setStage} />;
      case "order":
        return <OrderKind {...ctl} />;
      case "groups":
        return <GroupsKind {...ctl} />;
      case "multi":
        return <MultiKind {...ctl} />;
      case "rare":
        return <RareKind {...ctl} />;
      case "sort":
        return <SortKind {...ctl} />;
      case "map":
        return <MapKind {...ctl} />;
      case "wager":
        return <WagerKind {...ctl} />;
      case "chain":
        return <ChainKind {...ctl} />;
      case "memory":
        return <MemoryKind {...ctl} />;
      case "letters":
        return <LettersKind {...ctl} />;
    }
  })();
  return (
    <div className="flex w-full flex-col items-center gap-5">
      {header}
      <motion.h2 key={round.roundId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="display max-w-3xl text-center text-2xl font-bold text-white sm:text-3xl">
        {round.prompt}
      </motion.h2>
      {media.length > 0 && (
        <div className={`flex flex-wrap items-center justify-center gap-4 ${media.length > 1 ? "" : "min-h-24"}`}>
          {media.map((m, i) => (
            <MediaView key={i} m={m} size={media.length > 2 ? "md" : "lg"} />
          ))}
        </div>
      )}
      <div className="flex w-full justify-center">{body}</div>
    </div>
  );
}
