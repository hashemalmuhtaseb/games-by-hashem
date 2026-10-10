/**
 * Risk & Reward chip maths. Virtual chips only: they have no cash value, can't be bought, and
 * reset every match.
 *
 * Rules (also shown to players):
 *  - Everyone starts the match with the same balance (1,000 by default; the host can change it).
 *  - Each round you stake between 1 chip and your whole balance. A stake is final once placed.
 *  - The stake is deducted exactly once: you win back your stake plus profit at the round's odds,
 *    or you lose the stake. Balances never go below zero.
 *  - A balance of zero eliminates you. You can keep watching but can't bet again.
 *  - If only one player still has chips, they win immediately.
 *  - If every remaining player is eliminated in the same round, the one who had more chips before
 *    that round places higher; equal pre-round balances share the place.
 *  - When the rounds run out, the biggest balance wins; equal balances share the place.
 */

export const DEFAULT_STARTING_CHIPS = 1000;
export const MIN_STARTING_CHIPS = 100;
export const MAX_STARTING_CHIPS = 1_000_000;
export const MIN_STAKE = 1;

export interface Odds {
  /** Profit paid per `den` chips staked: 3/2 pays 3 profit for every 2 staked. */
  num: number;
  den: number;
  label: string;
}

/** Harder questions pay better odds. */
export function oddsForDifficulty(difficulty: number): Odds {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  if (d <= 2) return { num: 1, den: 1, label: "Evens (1/1)" };
  if (d === 3) return { num: 3, den: 2, label: "3/2" };
  if (d === 4) return { num: 2, den: 1, label: "2/1" };
  return { num: 5, den: 2, label: "5/2" };
}

/** Profit on a winning stake, rounded down to whole chips. */
export function profitFor(stake: number, odds: Odds): number {
  return Math.floor((stake * odds.num) / odds.den);
}

export interface StakeCheck {
  ok: boolean;
  stake?: number;
  error?: string;
}

/** Validates a stake against the player's live balance. Only whole, positive chips up to the balance. */
export function checkStake(raw: unknown, balance: number): StakeCheck {
  if (balance <= 0) return { ok: false, error: "You're out of chips." };
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return { ok: false, error: "Enter a whole number of chips." };
  if (!Number.isInteger(n)) return { ok: false, error: "Stakes must be whole chips." };
  if (n < MIN_STAKE) return { ok: false, error: "Stake at least 1 chip." };
  if (n > balance) return { ok: false, error: `You only have ${balance.toLocaleString("en")} chips.` };
  return { ok: true, stake: n };
}

/** Net change to a balance for a settled wager: +profit on a win, −stake on a loss, 0 with no stake. */
export function wagerNet(stake: number | null, correct: boolean, odds: Odds): number {
  if (!stake) return 0;
  return correct ? profitFor(stake, odds) : -stake;
}

export function applyNet(balance: number, net: number): number {
  return Math.max(0, balance + net);
}

export interface ChipPlayer {
  id: string;
  balance: number;
  eliminated: boolean;
  /** Round index of elimination (later is better). */
  eliminatedAt?: number;
  /** Balance before the round they were eliminated in, for simultaneous-elimination ties. */
  balanceBefore?: number;
}

export interface RoundSettlement {
  id: string;
  net: number;
}

/**
 * Applies a round's results to every player's balance and eliminates anyone left on zero.
 * Returns who was eliminated this round.
 */
export function settleChipRound(players: ChipPlayer[], results: RoundSettlement[], roundIndex: number): string[] {
  const out: string[] = [];
  for (const r of results) {
    const p = players.find((x) => x.id === r.id);
    if (!p || p.eliminated) continue;
    const before = p.balance;
    p.balance = applyNet(p.balance, r.net);
    if (p.balance === 0) {
      p.eliminated = true;
      p.eliminatedAt = roundIndex;
      p.balanceBefore = before;
      out.push(p.id);
    }
  }
  return out;
}

/** The match is decided once at most one player has chips (and it started with two or more). */
export function chipMatchDecided(players: ChipPlayer[]): boolean {
  if (players.length < 2) return players.every((p) => p.eliminated);
  return players.filter((p) => !p.eliminated).length <= 1;
}

/**
 * Final standings: players still holding chips first (by balance), then eliminated players, later
 * eliminations first, ties within the same round broken by the balance they had before it.
 * Equal keys share a rank (1, 1, 3…).
 */
export function chipStandings<T extends ChipPlayer>(players: T[]): (T & { rank: number })[] {
  const key = (p: ChipPlayer) => [p.eliminated ? 0 : 1, p.eliminated ? p.eliminatedAt ?? -1 : 0, p.balance, p.eliminated ? p.balanceBefore ?? 0 : 0];
  const cmp = (a: ChipPlayer, b: ChipPlayer) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  };
  const sorted = players.slice().sort(cmp);
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || cmp(sorted[i - 1], p) !== 0) rank = i + 1;
    return { ...p, rank };
  });
}
