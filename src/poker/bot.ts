import { bestHand, compareScores, newDeck, type Card } from "./cards";
import { legalActions, potTotal, type PokerAction, type Table } from "./table";

/**
 * Computer opponents for solo poker. They estimate their equity by Monte Carlo (random opponent
 * hands and board run-outs, using only the cards they can legitimately see) and compare it with the
 * pot odds. A little randomness keeps them from being predictable. Bots never look at anyone
 * else's hole cards or the deck order.
 */

export function equity(hole: Card[], board: Card[], opponents: number, samples: number, rnd: () => number): number {
  if (opponents <= 0) return 1;
  const known = new Set([...hole, ...board].map((c) => `${c.rank}${c.suit}`));
  const rest = newDeck().filter((c) => !known.has(`${c.rank}${c.suit}`));
  let won = 0;
  for (let s = 0; s < samples; s++) {
    // Partial shuffle: draw the cards we need.
    const need = opponents * 2 + (5 - board.length);
    const pool = rest.slice();
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rnd() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const full = [...board, ...pool.slice(opponents * 2, need)];
    const mine = bestHand([...hole, ...full]).score;
    let result = 1;
    for (let o = 0; o < opponents && result > 0; o++) {
      const theirs = bestHand([pool[o * 2], pool[o * 2 + 1], ...full]).score;
      const c = compareScores(mine, theirs);
      if (c < 0) result = 0;
      else if (c === 0) result = Math.min(result, 0.5);
    }
    won += result;
  }
  return won / samples;
}

export function botDecision(t: Table, seat: number, rnd: () => number, samples = 120): PokerAction {
  const h = t.hand!;
  const legal = legalActions(t, seat);
  if (!legal) return { type: "fold" };
  const me = h.players.find((p) => p.seat === seat)!;
  const opponents = h.players.filter((p) => p.seat !== seat && !p.folded).length;
  const eq = equity(me.hole, h.board, opponents, samples, rnd);
  const pot = potTotal(h);
  const noise = (rnd() - 0.5) * 0.08;
  const strength = eq + noise;
  const raiseTo = (fraction: number): PokerAction => {
    const target = Math.round(legal.currentBet + Math.max(legal.minRaiseTo - legal.currentBet, (pot + legal.call) * fraction));
    const to = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, target));
    return { type: "raise", to };
  };
  // Field-size aware thresholds: equity against several opponents is naturally lower.
  const fair = 1 / (opponents + 1);
  if (legal.check) {
    if (legal.canRaise && strength > fair + 0.3) return raiseTo(0.75);
    if (legal.canRaise && strength > fair + 0.15 && rnd() < 0.5) return raiseTo(0.5);
    if (legal.canRaise && rnd() < 0.06) return raiseTo(0.5); // occasional bluff
    return { type: "check" };
  }
  const potOdds = legal.call / (pot + legal.call);
  if (legal.canRaise && strength > Math.max(potOdds + 0.25, fair + 0.3)) return rnd() < 0.15 ? { type: "allin" } : raiseTo(0.8);
  if (strength >= potOdds - 0.02 || (legal.call <= h.bb && strength > fair * 0.6)) return { type: "call" };
  if (rnd() < 0.04) return { type: "call" };
  return { type: "fold" };
}
