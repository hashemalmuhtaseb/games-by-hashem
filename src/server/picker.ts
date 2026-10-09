import { mediaRegistry } from "@/lib/media";
import type { Rng } from "@/engine/rng";
import { gameCandidates, rememberInSession, selectCandidate, targetDifficulty, type HistoryView, type SessionMemory } from "@/engine/selection";
import type { GameDefinition, Round } from "@/engine/types";
import { excludedKeys } from "./history";
import { refreshCustomContent } from "./custom-content";

export interface PickState {
  modes?: string[];
  history: HistoryView;
  memory: SessionMemory;
  rng: Rng;
  skill: number;
  /** 0-based index of the round about to be played */
  index: number;
  /** 0 = endless */
  total: number;
  difficultyBoost?: number;
  ignoreHistory?: boolean;
  timeLimitSec?: number;
  notice?: string;
}

/**
 * Picks the next question via the anti-repetition engine and builds it. When the requested
 * modes run dry the pick widens to the whole game (with a notice) instead of repeating.
 */
export async function pickRound(st: PickState, game: GameDefinition): Promise<{ round: Round; repeat?: { daysAgo: number } } | null> {
  await refreshCustomContent().catch(() => undefined);
  const excluded = await excludedKeys();
  const total = st.total || 20;
  const target = targetDifficulty(st.skill, Math.min(st.index, total - 1), total) + (st.difficultyBoost ?? 0);
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidates = gameCandidates(game, st.modes);
    const sel = selectCandidate({ candidates, history: st.history, session: st.memory, targetDifficulty: target, rng: st.rng, now: Date.now(), excluded, ignoreHistory: st.ignoreHistory });
    if (!sel || (sel.freshRemaining === 0 && st.modes)) {
      if (st.modes) {
        st.modes = undefined;
        st.notice = "You've seen everything fresh in that mode — mixing in other modes.";
        continue;
      }
      if (!sel) return null;
    }
    try {
      const mode = game.modes.find((m) => m.id === sel.candidate.mode)!;
      const round = await mode.build(sel.candidate, { rng: st.rng, media: mediaRegistry, timeLimitSec: st.timeLimitSec });
      rememberInSession(st.memory, sel.candidate);
      return { round, repeat: sel.repeat };
    } catch {
      // Generator declined (e.g. not enough distinct distractors) — never pick it again this session.
      st.memory.keys.add(sel.candidate.key);
    }
  }
  return null;
}
