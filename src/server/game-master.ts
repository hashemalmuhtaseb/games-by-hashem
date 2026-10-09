import { pick, type Rng } from "@/engine/rng";
import { aiAvailable, aiComplete } from "@/content/pipeline/providers";
import { maskBlocked } from "@/lib/moderation";

/**
 * The Game Master is a room's play-by-play host. It speaks in chat at the start, after each
 * reveal and at the end. The built-in "classic" host is template-based and costs nothing;
 * the optional "ai" host asks the configured AI provider for a one-liner and silently falls
 * back to the classic line when no provider is set, the call fails or it takes too long.
 * It only ever sees what is already public (names, scores and the revealed answer).
 */

export type GMStyle = "off" | "classic" | "ai";

export type GMEvent =
  | { type: "start"; game: string; mode: string; players: string[]; rounds: number }
  | {
      type: "reveal";
      answer: string;
      round: number;
      total: number;
      correct: string[];
      wrong: string[];
      fastest?: string;
      streak?: { name: string; n: number };
      leader?: { name: string; score: number };
      newLeader?: boolean;
      bigScore?: { name: string; points: number };
    }
  | { type: "final"; winner: string; tie: boolean; margin: number; top: { name: string; score: number }[] };

const list = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function classicLine(ev: GMEvent, rng: Rng): string | null {
  switch (ev.type) {
    case "start": {
      const n = ev.players.length;
      return pick(rng, [
        `🎙️ Welcome to ${ev.game}! ${n} player${n === 1 ? "" : "s"}, ${ev.rounds || "endless"} rounds. Fingers on buzzers…`,
        `🎙️ ${list(ev.players.slice(0, 4))}${n > 4 ? " and friends" : ""}: ${ev.game} starts now. No pressure.`,
        `🎙️ Lights down, ${ev.game} up. May the fastest brain win.`,
        `🎙️ It's ${ev.game} time${ev.mode !== "classic" ? `, ${ev.mode} rules` : ""}. Let's see who's been studying.`,
      ]);
    }
    case "reveal": {
      const lines: string[] = [];
      ev = { ...ev, answer: ev.answer.replace(/[.!?]+$/, "") };
      const everyone = ev.wrong.length === 0 && ev.correct.length > 1;
      const nobody = ev.correct.length === 0 && ev.wrong.length > 0;
      if (nobody) lines.push(pick(rng, [`Nobody got it! It was ${ev.answer}. 😬`, `A clean sweep… of wrong answers. ${ev.answer}, everyone.`, `Stumped the whole room. The answer: ${ev.answer}.`]));
      else if (everyone) lines.push(pick(rng, ["Everyone got that one. Too easy? 😏", "Full marks across the board!", "A perfect round for the whole room."]));
      else if (ev.correct.length === 1 && ev.wrong.length >= 2) lines.push(pick(rng, [`Only ${ev.correct[0]} knew that one! 🧠`, `${ev.correct[0]} alone saw it coming.`, `Lone genius alert: ${ev.correct[0]}.`]));
      else if (ev.fastest) lines.push(pick(rng, [`${ev.fastest} was quickest on the draw. ⚡`, `Speed demon: ${ev.fastest}.`, `${ev.fastest} barely let the question finish.`]));
      if (ev.streak && ev.streak.n >= 3 && ev.streak.n % 2 === 1) lines.push(pick(rng, [`${ev.streak.name} is on a ${ev.streak.n}-streak! 🔥`, `${ev.streak.n} in a row for ${ev.streak.name}. Someone stop them.`]));
      if (ev.bigScore && ev.bigScore.points >= 250) lines.push(`${ev.bigScore.name} just banked ${ev.bigScore.points}! 💰`);
      if (ev.newLeader && ev.leader && ev.round > 1) lines.push(pick(rng, [`${ev.leader.name} takes the lead! 👑`, `New leader: ${ev.leader.name}.`, `${ev.leader.name} jumps to the top.`]));
      if (ev.total && ev.round === ev.total - 1) lines.push("Last round coming up. Everything to play for!");
      return lines.length ? `🎙️ ${lines.slice(0, 2).join(" ")}` : null;
    }
    case "final":
      if (ev.tie) return pick(rng, ["🎙️ A tie! Nobody leaves happy, nobody leaves sad.", "🎙️ Dead heat! You'll have to settle this with a rematch."]);
      if (ev.margin <= 50 && ev.top.length > 1) return `🎙️ ${ev.winner} wins by a whisker over ${ev.top[1].name}! What a finish.`;
      return pick(rng, [`🎙️ ${ev.winner} wins! Take a bow. 🏆`, `🎙️ And the champion is… ${ev.winner}! 🎉`, `🎙️ ${ev.winner} runs away with it. GG everyone.`]);
  }
}

function aiPrompt(ev: GMEvent): string {
  return [
    "You are the witty, warm host of a live party quiz game. Write ONE short line (max 120 characters) of play-by-play commentary for the event below.",
    "Be playful, never mean; no profanity; no questions to players; do not invent facts or scores. Reply with the line only.",
    `Event: ${JSON.stringify(ev)}`,
  ].join("\n");
}

function clean(line: string): string | null {
  const s = maskBlocked(line.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "")).slice(0, 160);
  return s.length >= 3 ? s : null;
}

export async function gameMasterLine(style: GMStyle, ev: GMEvent, rng: Rng): Promise<string | null> {
  if (style === "off") return null;
  const fallback = classicLine(ev, rng);
  // The AI host only comments on events the classic host would also mention, so chat never gets noisy.
  if (style !== "ai" || !fallback || !aiAvailable()) return fallback;
  try {
    const text = await Promise.race([aiComplete(aiPrompt(ev), 120), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]);
    const line = clean(text);
    return line ? `🎙️ ${line.replace(/^🎙️\s*/, "")}` : fallback;
  } catch {
    return fallback;
  }
}

export { aiAvailable as gameMasterAiAvailable };
