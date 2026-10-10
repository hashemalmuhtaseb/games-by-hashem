"use client";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Action, MediaRef, OptionPublic, PointsBreakdown, PublicRound, RevealPayload, SuggestSet } from "@/engine/types";
import { play } from "@/client/sound";
import { Icon } from "@/components/ui/Icon";
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
    <div className="pointer-events-none h-6 text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {msg && (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`text-sm font-medium ${msg.tone === "bad" ? "text-bad-400" : msg.tone === "good" ? "text-good-400" : "text-fg-2"}`}>
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
    idle: "bg-surface-1 shadow-[inset_0_0_0_1px_var(--color-line)] enabled:hover:bg-surface-2 enabled:hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
    picked: "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]",
    right: "bg-[color-mix(in_oklab,var(--color-good-500)_16%,var(--color-surface-1))] shadow-[inset_0_0_0_1.5px_var(--color-good-400)]",
    wrong: "bg-[color-mix(in_oklab,var(--color-bad-500)_14%,var(--color-surface-1))] shadow-[inset_0_0_0_1.5px_var(--color-bad-400)] animate-shake",
    missed: "bg-surface-1 shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--color-good-400)_60%,transparent)]",
  }[state];
  const faded = state === "idle" && disabled;
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03, duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex min-h-[60px] w-full items-center gap-3.5 rounded-[var(--radius-md)] px-4 py-3 text-left transition-[background-color,box-shadow,opacity] duration-150 disabled:cursor-default ${styles} ${faded ? "opacity-50" : ""}`}
    >
      <span className="kbd hidden sm:inline-grid">{i + 1}</span>
      {o.media && (
        <span className="shrink-0">
          <MediaView m={o.media} size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-snug font-medium text-fg sm:text-[17px]">{o.label}</span>
        {o.sub && <span className="num mt-0.5 block text-[13px] text-fg-3">{o.sub}</span>}
      </span>
      {state === "right" && <Icon name="check" size={20} strokeWidth={2.25} className="text-good-400" />}
      {state === "missed" && <Icon name="check" size={20} strokeWidth={2} className="text-good-400/70" />}
      {state === "wrong" && <Icon name="x" size={20} strokeWidth={2.25} className="text-bad-400" />}
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
    <div className={`grid w-full max-w-3xl gap-2 sm:gap-2.5 ${options.length > 4 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
      className={`relative flex w-full max-w-xl gap-2 rounded-[var(--radius-md)] bg-surface-1 p-1.5 shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_1px_var(--color-accent-line),0_0_0_4px_rgb(244_207_61/0.08)] ${shake ? "animate-shake" : ""}`}
      key={shake}
      onSubmit={(e) => {
        e.preventDefault();
        submit(hi >= 0 && matches[hi] ? matches[hi] : v);
      }}
    >
      <input
        ref={ref}
        className="min-w-0 flex-1 bg-transparent px-3 text-[17px] text-fg outline-none placeholder:text-fg-3 disabled:opacity-50"
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
      <button className="btn-primary shrink-0 px-5" disabled={disabled || !v.trim()} aria-label="Submit answer">
        <span className="hidden sm:inline">Submit</span>
        <Icon name="arrow-right" size={18} className="sm:hidden" />
      </button>
      {matches.length > 0 && !disabled && (
        <ul role="listbox" className="popover absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden p-1">
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === hi}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => submit(m)}
                className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-[15px] transition-colors duration-100 ${i === hi ? "bg-surface-4 text-fg" : "text-fg-2"}`}
              >
                {m}
                {i === hi && <span className="kbd">↵</span>}
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
            <span key={i} className="chip text-fg-3 line-through decoration-bad-400/70">
              {w}
            </span>
          ))}
        </div>
      )}
      {!done && (
        <button className="btn-quiet btn-sm" onClick={() => act({ type: "give-up" })}>
          Skip this one
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
      <div className="display num text-[56px] leading-none font-semibold text-fg">
        {val.toLocaleString()}
        {spec.unit && <span className="ml-2 text-xl font-medium text-fg-3">{spec.unit}</span>}
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
        className="range w-full"
        aria-label="Your estimate"
      />
      <div className="num -mt-1 flex w-full justify-between font-mono text-xs text-fg-3">
        <span>{spec.min.toLocaleString()}</span>
        <span>{spec.max.toLocaleString()}</span>
      </div>
      <div className="flex w-full gap-2">
        <input
          className="input num min-h-12 text-center text-lg"
          aria-label="Type an exact number"
          inputMode="numeric"
          value={text}
          disabled={done}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(/[, ]/g, ""));
            if (Number.isFinite(n) && n >= spec.min && n <= spec.max) setVal(n);
          }}
        />
        <button className="btn-primary min-h-12 px-8" disabled={done}>
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
            <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className={`flex gap-4 rounded-[var(--radius-md)] px-4 py-3.5 ${i === clues.length - 1 ? "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "bg-surface-1 shadow-[inset_0_0_0_1px_var(--color-line)]"}`}>
              <span className="num w-5 shrink-0 pt-0.5 font-mono text-xs text-fg-3">{String(i + 1).padStart(2, "0")}</span>
              <span className={`text-[16px] leading-relaxed whitespace-pre-line text-fg ${/_ /.test(c) ? "font-mono tracking-wider" : ""}`}>{c}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="flex items-center gap-3 text-sm text-fg-3">
        <span>
          Clue {clues.length} of {total}
        </span>
        {!done && clues.length < total && (
          <button className="btn-ghost btn-sm" onClick={async () => handle(await act({ type: "hint" }))}>
            <Icon name="bulb" size={15} />
            Next clue <span className="text-fg-3">costs points</span>
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
        <button className="btn-quiet btn-sm" onClick={() => act({ type: "give-up" })}>
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
      <div className="flex items-center gap-3 text-sm text-fg-3">
        <span>
          Reveal {step} of {total}
        </span>
        {!done && step < total && (
          <button
            className="btn-ghost btn-sm"
            onClick={async () => {
              const r = await act({ type: "hint" });
              if (r?.reveal?.media) {
                ctl.setStage(r.reveal.media as MediaRef);
                setStep((s) => s + 1);
                play("hint");
              }
            }}
          >
            <Icon name="eye" size={15} />
            Reveal more <span className="text-fg-3">costs points</span>
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
      {!matchMedia && (
        <div className="label flex items-center justify-center gap-1.5">
          <Icon name="arrow-up-right" size={14} className="-rotate-45" />
          {ends[0]}
        </div>
      )}
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
              whileDrag={{ scale: 1.02, boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.6), inset 0 0 0 1px rgb(255 255 245 / 0.13)" }}
              className={`flex h-16 cursor-grab touch-none items-center gap-3 rounded-[var(--radius-md)] px-3 active:cursor-grabbing ${reveal ? (correctAt(o.id, i) ? "bg-[color-mix(in_oklab,var(--color-good-500)_14%,var(--color-surface-1))] shadow-[inset_0_0_0_1.5px_var(--color-good-400)]" : "bg-[color-mix(in_oklab,var(--color-bad-500)_12%,var(--color-surface-1))] shadow-[inset_0_0_0_1.5px_var(--color-bad-400)]") : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]"}`}
            >
              <span className="num w-5 text-center font-mono text-xs text-fg-3">{i + 1}</span>
              {o.media && <MediaView m={o.media} size="sm" />}
              <span className="min-w-0 flex-1 font-medium text-fg">
                {o.label}
                {o.sub && <span className="num block text-[13px] font-normal text-fg-3">{o.sub}</span>}
              </span>
              {!(done || submitted) ? (
                <span className="flex items-center">
                  <button aria-label="Move up" className="btn-icon h-9 min-h-9 w-8" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="chevron-down" size={16} className="rotate-180" />
                  </button>
                  <button aria-label="Move down" className="btn-icon h-9 min-h-9 w-8" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="chevron-down" size={16} />
                  </button>
                  <Icon name="grip" size={16} className="ml-1 text-fg-4" />
                </span>
              ) : reveal ? (
                <Icon name={correctAt(o.id, i) ? "check" : "x"} size={18} strokeWidth={2.25} className={correctAt(o.id, i) ? "text-good-400" : "text-bad-400"} />
              ) : null}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
      {!matchMedia && (
        <div className="label flex items-center justify-center gap-1.5">
          <Icon name="arrow-up-right" size={14} className="rotate-135" />
          {ends[1]}
        </div>
      )}
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

/** Four solved-group colours, from easiest to hardest. Muted so the tiles stay the loudest thing. */
const GROUP_COLORS = ["bg-[#e8cf6a] text-[#1d1803]", "bg-[#93cf84] text-[#0d1f08]", "bg-[#94b6f2] text-[#0b1630]", "bg-[#c2a6ea] text-[#1c0f33]"];

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
        <motion.div key={g.label} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className={`flex min-h-[68px] flex-col justify-center rounded-[var(--radius-md)] px-4 py-3 text-center ${GROUP_COLORS[g.level % 4]}`}>
          <div className="text-[15px] font-semibold">{g.label}</div>
          <div className="mt-0.5 text-sm opacity-80">{g.ids.map((id) => byId.get(id)?.label).join(", ")}</div>
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
              aria-pressed={on}
              transition={{ layout: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] } }}
              className={`min-h-[68px] rounded-[var(--radius-md)] px-1.5 text-center text-[13px] leading-tight font-semibold transition-colors duration-100 sm:text-[15px] ${on ? "bg-fg text-canvas" : "bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface-3"}`}
            >
              {o.label}
            </motion.button>
          );
        })}
      </div>
      {toast.node}
      {!done && (
        <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-fg-3" aria-label={`${4 - mistakes} mistakes left`}>
            Mistakes
            <span className="flex gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full transition-colors duration-200 ${i < 4 - mistakes ? "bg-fg-2" : "bg-surface-4"}`} />
              ))}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="btn-quiet btn-sm" onClick={() => setOrder((o) => [...o].sort(() => Math.random() - 0.5))}>
              <Icon name="shuffle" size={15} />
              Shuffle
            </button>
            <button className="btn-quiet btn-sm" onClick={() => setSel([])} disabled={!sel.length}>
              Deselect
            </button>
            <button
              className="btn-primary btn-sm px-4"
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
          <div key={i} className={`h-1.5 w-10 rounded-full transition-colors duration-300 ${found[i] ? "bg-good-400" : "bg-surface-3"}`} />
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
          <motion.span key={f} initial={{ y: 4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="chip h-8 bg-[color-mix(in_oklab,var(--color-good-500)_12%,var(--color-surface-2))] px-3 text-sm text-fg">
            <Icon name="check" size={14} strokeWidth={2.25} className="text-good-400" />
            {f}
          </motion.span>
        ))}
      </div>
      {!done && found.length > 0 && found.length < target && (
        <button className="btn-quiet btn-sm" onClick={() => act({ type: "finish" })}>
          That&apos;s all I&apos;ve got
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
        <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} className="text-center">
          {res.valid ? (
            <>
              <div className="text-sm text-fg-2">{res.canonical}</div>
              <div className="display num mt-1 text-[56px] leading-none font-semibold text-fg">
                {res.rarityPoints}
                <span className="ml-2 text-lg font-medium text-fg-3">rarity</span>
              </div>
              {res.percent !== undefined && <div className="mt-2 text-sm text-fg-3">About {res.percent}% of players would say this</div>}
            </>
          ) : (
            <div className="text-lg font-medium text-bad-400">Not a valid answer · −10</div>
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
        <div key={o.id} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-1 p-1.5 pl-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <span className="min-w-0 flex-1 font-medium text-fg">{o.label}</span>
          <span className="flex rounded-[var(--radius-sm)] bg-surface-2 p-0.5">
            {buckets.map((b, bi) => (
              <button
                key={b}
                disabled={done}
                aria-pressed={assign[o.id] === bi}
                onClick={() => {
                  play("click");
                  setAssign((a) => ({ ...a, [o.id]: bi as 0 | 1 }));
                }}
                className={`rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors duration-100 ${assign[o.id] === bi ? (bi === 0 ? "bg-[#94b6f2] text-[#0b1630]" : "bg-[#eea676] text-[#2a1405]") : "text-fg-3 hover:text-fg"}`}
              >
                {b}
              </button>
            ))}
          </span>
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

const BEARING: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

function Bearing({ dir }: { dir: string }) {
  if (!(dir in BEARING)) return <Icon name="check" size={18} strokeWidth={2.25} className="text-good-400" />;
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3" title={dir}>
      <span style={{ transform: `rotate(${BEARING[dir] - 45}deg)` }} className="grid place-items-center">
        <Icon name="arrow-up-right" size={15} strokeWidth={2} className="text-fg" />
      </span>
    </span>
  );
}

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
          <motion.div key={g.name} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="relative grid h-11 grid-cols-[1fr_auto_auto_auto] items-center gap-4 overflow-hidden rounded-[var(--radius-sm)] bg-surface-1 px-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <span className="absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--color-accent)_9%,transparent)]" style={{ width: `${g.pct}%` }} />
            <span className="relative truncate font-medium text-fg">
              <span className="num mr-2 font-mono text-xs text-fg-3">{i + 1}</span>
              {g.name}
            </span>
            <span className="num relative text-sm text-fg-2">{g.km.toLocaleString()} km</span>
            <span className="relative">
              <Bearing dir={g.dir} />
            </span>
            <span className="num relative w-11 text-right font-semibold text-fg">{g.pct}%</span>
          </motion.div>
        ))}
        {Array.from({ length: Math.max(0, 6 - guesses.length) }, (_, i) => (
          <div key={i} className="h-11 rounded-[var(--radius-sm)] shadow-[inset_0_0_0_1px_var(--color-line)]" />
        ))}
      </div>
      {!done && (
        <button className="btn-quiet btn-sm" onClick={() => act({ type: "give-up" })}>
          Give up
        </button>
      )}
    </div>
  );
}

function WagerKind({ round, act, locked, resume, reveal }: Ctl) {
  const max = (round.extra?.maxBet as number) ?? 100;
  const [bet, setBet] = useState(Math.round(max / 2 / 10) * 10);
  const [q, setQ] = useState<QReveal | null>(resume?.reveal ?? null);
  const [picked, setPicked] = useState<string | null>(null);
  const done = locked || !!resume?.done;
  if (!q)
    return (
      <div className="card flex w-full max-w-md flex-col gap-5 p-6">
        <div className="text-center text-fg-2">How sure are you? A right answer doubles your stake; a wrong one loses it.</div>
        <div className="text-center">
          <div className="label">Stake</div>
          <div className="display num mt-1 text-[56px] leading-none font-semibold text-fg">{bet}</div>
        </div>
        <input type="range" min={10} max={max} step={10} value={bet} onChange={(e) => setBet(Number(e.target.value))} className="range w-full" disabled={done} aria-label="Stake" />
        <dl className="num grid grid-cols-2 gap-2 text-center">
          <div className="well py-3">
            <dt className="label">If right</dt>
            <dd className="mt-0.5 text-lg font-semibold text-good-400">+{bet}</dd>
          </div>
          <div className="well py-3">
            <dt className="label">If wrong</dt>
            <dd className="mt-0.5 text-lg font-semibold text-bad-400">−{bet}</dd>
          </div>
        </dl>
        <button
          className="btn-primary btn-lg w-full"
          disabled={done}
          onClick={async () => {
            const r = await act({ type: "bet", value: bet });
            if (r?.reveal) setQ(r.reveal as QReveal);
            play("start");
          }}
        >
          Stake {bet} and see the question
        </button>
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {q.prompt && <div className="display max-w-2xl text-center text-[22px] leading-snug font-semibold text-fg">{q.prompt}</div>}
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
        <span className="text-fg-3">At least {minLen} letters</span>
        <span className="display num text-xl font-semibold text-fg">{score}</span>
        <span className={`num flex items-center gap-1.5 font-mono ${left < 4 ? "text-bad-400" : "text-fg-2"}`}>
          <Icon name="clock" size={15} />
          {left.toFixed(0)}s
        </span>
      </div>
      <div ref={scroller} className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-[var(--radius-lg)] bg-surface-1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
        {words.map((x, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[80%] rounded-[14px] px-3.5 py-1.5 font-medium ${x.by === "you" ? "self-end bg-accent text-accent-ink" : "self-start bg-surface-3 text-fg"}`}>
            {x.w}
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-fg-2">
        Next word starts with
        <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-surface-3 font-mono text-lg text-fg uppercase">{last.slice(-1)}</span>
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
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.26 }} className="grid min-h-28 place-items-center rounded-[var(--radius-md)] bg-surface-1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <MediaView m={m} size="md" />
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-fg-3">
          Memorise
          <div className="h-1 w-48 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-fg-2" style={{ width: `${(left / studySeconds) * 100}%` }} />
          </div>
          <span className="num w-6 font-mono">{Math.ceil(left)}</span>
        </div>
        <button className="btn-ghost" onClick={ready} disabled={done}>
          I&apos;m ready
        </button>
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {q?.prompt && <div className="display max-w-2xl text-center text-[22px] leading-snug font-semibold text-fg">{q.prompt}</div>}
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
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.035, duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            whileTap={{ scale: 0.94 }}
            disabled={done || used[i]}
            onClick={() => setWord((w) => w + l.toLowerCase())}
            className={`grid h-14 w-12 place-items-center rounded-[var(--radius-sm)] font-mono text-2xl font-medium transition-colors duration-100 ${used[i] ? "bg-surface-1 text-fg-4 shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-fg text-canvas shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] hover:bg-white"}`}
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
        <input className="input min-h-12 text-center font-mono text-2xl tracking-[0.3em] uppercase" value={word} onChange={(e) => setWord(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, letters.length))} disabled={done} placeholder="YOUR WORD" autoFocus />
        <button type="button" className="btn-ghost min-h-12 w-12 px-0" onClick={() => setWord("")} disabled={done} aria-label="Clear word">
          <Icon name="backspace" size={18} />
        </button>
        <button className="btn-primary min-h-12 px-6" disabled={done || word.length < 3}>
          Forge
        </button>
      </form>
      {res && !res.valid && (
        <div className="text-sm font-medium text-bad-400">
          {res.reason}
          {res.attemptsLeft ? ` · ${res.attemptsLeft} ${res.attemptsLeft === 1 ? "try" : "tries"} left` : ""}
        </div>
      )}
      {res?.valid && (
        <div className="text-center">
          <div className="display num text-3xl font-semibold text-fg">{res.length} letters</div>
          <div className="text-sm text-fg-3">Longest possible: {res.best}</div>
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
  const urgent = pct <= 20 && !stopped;
  const color = stopped ? "bg-fg-4" : pct > 40 ? "bg-fg-2" : pct > 20 ? "bg-warn-400" : "bg-bad-400";
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full transition-colors duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`num w-7 text-right font-mono text-sm transition-colors duration-300 ${urgent ? "text-bad-400" : "text-fg-3"}`}>{paused ? <Icon name="pause" size={14} className="ml-auto" /> : Math.ceil(left)}</span>
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
}: {
  round: PublicRound;
  act: (a: Action) => Promise<ActResponse | null>;
  locked: boolean;
  reveal: RevealPayload | null;
  resume: Resume | null;
  header?: ReactNode;
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
  const ctl: Ctl = { round, act: wrapped, locked: locked || !!reveal, reveal, resume, busy };
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
    <div className="flex w-full flex-col items-center gap-7 sm:gap-8">
      {header}
      <motion.h2
        key={round.roundId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        className="display max-w-[40rem] text-center text-[24px] leading-[1.22] font-semibold text-balance text-fg sm:text-[30px]"
      >
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
