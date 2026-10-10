import { bestHand, compareScores, newDeck, shuffleDeck, type Card, type HandValue } from "./cards";

/**
 * Texas Hold'em table engine (no-limit, virtual chips only). Pure and deterministic given the
 * random source, so every rule is unit-testable. The server owns the only copy of a table; players
 * only ever receive `viewFor()`, which never contains the deck or another player's hole cards
 * before showdown.
 *
 * Rules implemented:
 *  - Dealer button rotates to the next player with chips each hand.
 *  - Blinds: small blind left of the button, big blind next. Heads-up the button posts the small
 *    blind and acts first before the flop, last after it. A short stack posts what it has (all-in).
 *  - Betting order: first player left of the big blind pre-flop, first active player left of the
 *    button on later streets.
 *  - No-limit: minimum bet is the big blind; a raise must be at least the size of the last full
 *    bet or raise. An all-in for less than a full raise does not reopen the betting for players
 *    who have already acted.
 *  - When at most one player can still bet, the remaining cards are dealt out automatically.
 *  - Side pots: each all-in level forms its own pot; only players who matched it and haven't
 *    folded can win it. Uncalled chips return to their owner.
 *  - Split pots: equal hands share a pot; odd chips go to the winners closest to the button's left.
 *  - Busted players sit out; the last player with chips wins the table.
 */

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export interface Seat {
  id: string;
  name: string;
  avatar: string;
  photo: string | null;
  color: string;
  stack: number;
  bot: boolean;
  /** Busted (no chips) — spectating until the table resets. */
  out: boolean;
  connected: boolean;
  /** Order players busted in (1 = first), for final standings. */
  bustOrder?: number;
}

export interface HandPlayer {
  seat: number;
  id: string;
  hole: Card[];
  /** Chips committed on the current street. */
  bet: number;
  /** Chips committed this hand. */
  total: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
  /** fullRaises counter when this player last acted (to know if betting was reopened). */
  seenRaises: number;
  lastAction?: string;
}

export interface PotResult {
  amount: number;
  eligible: string[];
  winners: string[];
  share: number;
  hand?: string;
}

export interface HandResult {
  pots: PotResult[];
  /** Hole cards shown at showdown (players who didn't fold). Empty when everyone else folded. */
  shown: { id: string; hole: Card[]; hand: HandValue }[];
  winnings: Record<string, number>;
  uncontested: boolean;
}

export interface Hand {
  no: number;
  deck: Card[];
  board: Card[];
  street: Street;
  players: HandPlayer[];
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  sb: number;
  bb: number;
  currentBet: number;
  /** Size of the last full bet/raise on this street (at least the big blind). */
  minRaise: number;
  fullRaises: number;
  toAct: number | null;
  result?: HandResult;
  /** Running log shown in the UI. */
  log: string[];
}

export interface Table {
  seats: (Seat | null)[];
  button: number;
  sb: number;
  bb: number;
  handsPlayed: number;
  /** Blinds double every `levelHands` hands (0 = never), so tables always finish. */
  levelHands: number;
  hand: Hand | null;
  busts: number;
}

export type RandInt = (maxExclusive: number) => number;

export function createTable(opts: { maxSeats?: number; sb?: number; bb?: number; levelHands?: number } = {}): Table {
  const maxSeats = Math.min(8, Math.max(2, opts.maxSeats ?? 8));
  const bb = opts.bb ?? 20;
  return { seats: Array.from({ length: maxSeats }, () => null), button: -1, sb: opts.sb ?? Math.max(1, Math.floor(bb / 2)), bb, handsPlayed: 0, levelHands: opts.levelHands ?? 10, hand: null, busts: 0 };
}

export function seatPlayer(t: Table, p: Omit<Seat, "out" | "connected"> & { connected?: boolean }, at?: number): number {
  if (t.seats.some((s) => s?.id === p.id)) throw new Error("Already seated.");
  const idx = at !== undefined && t.seats[at] === null ? at : t.seats.findIndex((s) => s === null);
  if (idx < 0) throw new Error("The table is full.");
  t.seats[idx] = { ...p, out: p.stack <= 0, connected: p.connected ?? true };
  return idx;
}

/** Seats that can be dealt into the next hand. */
export function activeSeats(t: Table): number[] {
  return t.seats.map((s, i) => (s && !s.out && s.stack > 0 ? i : -1)).filter((i) => i >= 0);
}

function nextFrom(seats: number[], from: number, n: number): number {
  // seats sorted ascending; next seat strictly after `from` (wrapping).
  const after = seats.find((s) => s > from);
  return after ?? seats[0];
  void n;
}

function handPlayer(h: Hand, seat: number): HandPlayer | undefined {
  return h.players.find((p) => p.seat === seat);
}

function canStillBet(p: HandPlayer): boolean {
  return !p.folded && !p.allIn;
}

function post(h: Hand, t: Table, p: HandPlayer, amount: number): number {
  const s = t.seats[p.seat]!;
  const put = Math.min(amount, s.stack);
  s.stack -= put;
  p.bet += put;
  p.total += put;
  if (s.stack === 0) p.allIn = true;
  return put;
}

export function startHand(t: Table, randInt: RandInt): Hand {
  const seats = activeSeats(t);
  if (seats.length < 2) throw new Error("Need at least two players with chips.");
  if (t.hand && t.hand.street !== "showdown") throw new Error("A hand is already in progress.");
  if (t.levelHands > 0 && t.handsPlayed > 0 && t.handsPlayed % t.levelHands === 0) {
    t.bb *= 2;
    t.sb = Math.max(1, Math.floor(t.bb / 2));
  }
  t.button = t.button < 0 ? seats[randInt(seats.length)] : nextFrom(seats, t.button, seats.length);
  const headsUp = seats.length === 2;
  const sbSeat = headsUp ? t.button : nextFrom(seats, t.button, seats.length);
  const bbSeat = nextFrom(seats, sbSeat, seats.length);
  const deck = shuffleDeck(newDeck(), randInt);
  const h: Hand = {
    no: t.handsPlayed + 1,
    deck,
    board: [],
    street: "preflop",
    players: seats.map((seat) => ({ seat, id: t.seats[seat]!.id, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, seenRaises: -1 })),
    buttonSeat: t.button,
    sbSeat,
    bbSeat,
    sb: t.sb,
    bb: t.bb,
    currentBet: 0,
    minRaise: t.bb,
    fullRaises: 0,
    toAct: null,
    log: [],
  };
  // Deal two cards each, one at a time starting left of the button.
  const order = dealOrder(seats, t.button);
  for (let r = 0; r < 2; r++) for (const seat of order) handPlayer(h, seat)!.hole.push(h.deck.pop()!);
  const sbP = handPlayer(h, sbSeat)!;
  const bbP = handPlayer(h, bbSeat)!;
  const sbPut = post(h, t, sbP, t.sb);
  const bbPut = post(h, t, bbP, t.bb);
  h.log.push(`${t.seats[sbSeat]!.name} posts small blind ${sbPut}`, `${t.seats[bbSeat]!.name} posts big blind ${bbPut}`);
  h.currentBet = Math.max(sbPut, bbPut);
  // The big blind counts as a full bet of one big blind even when posted short.
  h.minRaise = t.bb;
  h.toAct = headsUp ? sbSeat : nextFrom(seats, bbSeat, seats.length);
  t.hand = h;
  settleIfDone(t, randInt);
  return h;
}

function dealOrder(seats: number[], button: number): number[] {
  const i = seats.indexOf(button);
  return [...seats.slice(i + 1), ...seats.slice(0, i + 1)];
}

export interface Legal {
  fold: boolean;
  check: boolean;
  /** Chips needed to call (0 when checking is possible). */
  call: number;
  canRaise: boolean;
  /** "bet" when nobody has bet this street, otherwise "raise". */
  raiseLabel: "bet" | "raise";
  minRaiseTo: number;
  maxRaiseTo: number;
  stack: number;
  currentBet: number;
  pot: number;
}

export function potTotal(h: Hand): number {
  return h.players.reduce((s, p) => s + p.total, 0);
}

export function legalActions(t: Table, seat: number): Legal | null {
  const h = t.hand;
  if (!h || h.street === "showdown" || h.toAct !== seat) return null;
  const p = handPlayer(h, seat)!;
  const stack = t.seats[seat]!.stack;
  const toCall = Math.max(0, h.currentBet - p.bet);
  const call = Math.min(toCall, stack);
  const othersCanBet = h.players.some((o) => o.seat !== seat && canStillBet(o));
  const reopened = !p.acted || h.fullRaises > p.seenRaises;
  const maxRaiseTo = p.bet + stack;
  const minRaiseTo = h.currentBet === 0 ? Math.min(h.bb, maxRaiseTo) : Math.min(h.currentBet + h.minRaise, maxRaiseTo);
  const canRaise = stack > toCall && reopened && othersCanBet;
  return { fold: true, check: toCall === 0, call: toCall === 0 ? 0 : call, canRaise, raiseLabel: h.currentBet === 0 ? "bet" : "raise", minRaiseTo, maxRaiseTo, stack, currentBet: h.currentBet, pot: potTotal(h) };
}

export type PokerAction = { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number } | { type: "allin" };

export function act(t: Table, seat: number, a: PokerAction, randInt: RandInt): { error?: string } {
  const h = t.hand;
  if (!h || h.street === "showdown") return { error: "No hand in progress." };
  if (h.toAct !== seat) return { error: "It's not your turn." };
  const legal = legalActions(t, seat)!;
  const p = handPlayer(h, seat)!;
  const name = t.seats[seat]!.name;
  let action = a;
  if (action.type === "allin") {
    const to = legal.maxRaiseTo;
    action = to > h.currentBet && legal.canRaise ? { type: "raise", to } : { type: "call" };
    if (!legal.canRaise && legal.call === 0) action = { type: "check" };
  }
  switch (action.type) {
    case "fold":
      p.folded = true;
      p.lastAction = "Fold";
      h.log.push(`${name} folds`);
      break;
    case "check":
      if (!legal.check) return { error: `You need to call ${legal.call} or fold.` };
      p.lastAction = "Check";
      h.log.push(`${name} checks`);
      break;
    case "call": {
      if (legal.call === 0) {
        p.lastAction = "Check";
        h.log.push(`${name} checks`);
        break;
      }
      const put = post(h, t, p, legal.call);
      p.lastAction = p.allIn ? `All-in ${p.bet}` : `Call ${put}`;
      h.log.push(`${name} calls ${put}${p.allIn ? " (all-in)" : ""}`);
      break;
    }
    case "raise": {
      if (!legal.canRaise) return { error: legal.call > 0 ? "You can only call or fold here." : "You can't raise here." };
      const to = Math.floor(action.to);
      if (!Number.isFinite(to)) return { error: "Enter an amount." };
      if (to > legal.maxRaiseTo) return { error: `You only have ${legal.stack} chips.` };
      if (to < legal.minRaiseTo && to !== legal.maxRaiseTo) return { error: `The minimum ${legal.raiseLabel} is ${legal.minRaiseTo}.` };
      if (to <= h.currentBet) return { error: `The minimum ${legal.raiseLabel} is ${legal.minRaiseTo}.` };
      const raiseSize = to - h.currentBet;
      post(h, t, p, to - p.bet);
      if (raiseSize >= h.minRaise) {
        h.minRaise = raiseSize;
        h.fullRaises++;
      }
      const wasBet = h.currentBet === 0;
      h.currentBet = to;
      p.lastAction = p.allIn ? `All-in ${to}` : wasBet ? `Bet ${to}` : `Raise to ${to}`;
      h.log.push(`${name} ${wasBet ? "bets" : "raises to"} ${to}${p.allIn ? " (all-in)" : ""}`);
      break;
    }
  }
  p.acted = true;
  p.seenRaises = h.fullRaises;
  advance(t, randInt);
  return {};
}

function needsToAct(h: Hand, p: HandPlayer): boolean {
  return canStillBet(p) && (!p.acted || p.bet < h.currentBet);
}

function bettingDone(h: Hand): boolean {
  const live = h.players.filter(canStillBet);
  if (live.length === 0) return true;
  if (live.length === 1 && live[0].bet >= h.currentBet) return true;
  return !h.players.some((p) => needsToAct(h, p));
}

function advance(t: Table, randInt: RandInt) {
  const h = t.hand!;
  const inHand = h.players.filter((p) => !p.folded);
  if (inHand.length === 1) {
    finishHand(t, true);
    return;
  }
  if (!bettingDone(h)) {
    const seats = h.players.map((p) => p.seat);
    let s = h.toAct!;
    for (let i = 0; i < seats.length; i++) {
      s = nextFrom(seats, s, seats.length);
      const p = handPlayer(h, s)!;
      if (needsToAct(h, p)) {
        h.toAct = s;
        return;
      }
    }
  }
  nextStreet(t, randInt);
}

function settleIfDone(t: Table, randInt: RandInt) {
  // Blinds can put everyone all-in before anyone acts.
  const h = t.hand!;
  const p = handPlayer(h, h.toAct!);
  if (!p || !needsToAct(h, p) || bettingDone(h)) advance(t, randInt);
}

function nextStreet(t: Table, randInt: RandInt) {
  const h = t.hand!;
  for (;;) {
    for (const p of h.players) {
      p.bet = 0;
      p.acted = false;
      p.seenRaises = -1;
      if (!p.folded && !p.allIn) p.lastAction = undefined;
    }
    h.currentBet = 0;
    h.minRaise = h.bb;
    h.fullRaises = 0;
    if (h.street === "river") {
      finishHand(t, false);
      return;
    }
    h.deck.pop(); // burn
    if (h.street === "preflop") {
      h.board.push(h.deck.pop()!, h.deck.pop()!, h.deck.pop()!);
      h.street = "flop";
    } else if (h.street === "flop") {
      h.board.push(h.deck.pop()!);
      h.street = "turn";
    } else {
      h.board.push(h.deck.pop()!);
      h.street = "river";
    }
    const canBet = h.players.filter(canStillBet);
    if (canBet.length >= 2) {
      const seats = h.players.map((p) => p.seat);
      let s = h.buttonSeat;
      for (let i = 0; i < seats.length; i++) {
        s = nextFrom(seats, s, seats.length);
        if (canStillBet(handPlayer(h, s)!)) break;
      }
      h.toAct = s;
      return;
    }
    // Nobody (or only one player) can bet: run the board out.
  }
  void randInt;
}

/** Splits committed chips into main and side pots. Folded chips stay in the pots they reached. */
export function buildPots(players: { id: string; total: number; folded: boolean }[]): { amount: number; eligible: string[] }[] {
  const remaining = new Map(players.map((p) => [p.id, p.total]));
  const pots: { amount: number; eligible: string[] }[] = [];
  for (;;) {
    const live = players.filter((p) => !p.folded && remaining.get(p.id)! > 0);
    if (!live.length) break;
    const cap = Math.min(...live.map((p) => remaining.get(p.id)!));
    let amount = 0;
    for (const p of players) {
      const r = remaining.get(p.id)!;
      const take = Math.min(r, cap);
      amount += take;
      remaining.set(p.id, r - take);
    }
    pots.push({ amount, eligible: live.map((p) => p.id) });
  }
  // Chips from folded players above every live player's commitment go to the last pot.
  const leftover = [...remaining.values()].reduce((a, b) => a + b, 0);
  if (leftover > 0) {
    if (pots.length) pots[pots.length - 1].amount += leftover;
  }
  return pots;
}

function finishHand(t: Table, uncontested: boolean) {
  const h = t.hand!;
  h.street = "showdown";
  h.toAct = null;
  const winnings: Record<string, number> = {};
  const result: HandResult = { pots: [], shown: [], winnings, uncontested };
  const live = h.players.filter((p) => !p.folded);
  const values = new Map<string, HandValue>();
  if (!uncontested) {
    for (const p of live) {
      const v = bestHand([...p.hole, ...h.board]);
      values.set(p.id, v);
      result.shown.push({ id: p.id, hole: p.hole, hand: v });
    }
  }
  // Seat order starting left of the button, for odd chips.
  const seatsOrder = dealOrder(
    h.players.map((p) => p.seat),
    h.buttonSeat,
  ).map((s) => handPlayer(h, s)!.id);
  for (const pot of buildPots(h.players)) {
    let winners: string[];
    if (pot.eligible.length === 1 || uncontested) {
      winners = uncontested ? [live[0].id] : pot.eligible;
    } else {
      let best: number[] | null = null;
      winners = [];
      for (const id of pot.eligible) {
        const sc = values.get(id)!.score;
        const c = best ? compareScores(sc, best) : 1;
        if (c > 0) {
          best = sc;
          winners = [id];
        } else if (c === 0) winners.push(id);
      }
    }
    winners.sort((a, b) => seatsOrder.indexOf(a) - seatsOrder.indexOf(b));
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      winnings[w] = (winnings[w] ?? 0) + share + extra;
    }
    result.pots.push({ amount: pot.amount, eligible: pot.eligible, winners, share, hand: winners.length && values.get(winners[0]) ? values.get(winners[0])!.name : undefined });
  }
  for (const [id, amt] of Object.entries(winnings)) {
    const seat = t.seats.find((s) => s?.id === id);
    if (seat) seat.stack += amt;
  }
  for (const pr of result.pots) {
    const names = pr.winners.map((id) => t.seats.find((s) => s?.id === id)?.name ?? "?");
    h.log.push(`${names.join(" & ")} ${pr.winners.length > 1 ? "split" : "wins"} ${pr.amount}${pr.hand ? ` with ${pr.hand}` : ""}`);
  }
  // Bust anyone left without chips. Players busting in the same hand place by the stack they
  // started it with (bigger stack places higher); equal stacks share the place.
  const busted = h.players.filter((p) => t.seats[p.seat]!.stack === 0 && !t.seats[p.seat]!.out).sort((a, b) => a.total - b.total);
  let prevTotal = -1;
  for (const p of busted) {
    const s = t.seats[p.seat]!;
    s.out = true;
    if (p.total !== prevTotal) t.busts++;
    s.bustOrder = t.busts;
    prevTotal = p.total;
  }
  h.result = result;
  t.handsPlayed++;
}

export function tableWinner(t: Table): Seat | null {
  const alive = t.seats.filter((s): s is Seat => !!s && !s.out && s.stack > 0);
  return alive.length === 1 ? alive[0] : null;
}

/** Final standings: chips left (desc), then busted players, last to bust first. */
export function standings(t: Table): { id: string; name: string; stack: number; rank: number }[] {
  const seated = t.seats.filter((s): s is Seat => !!s);
  const sorted = seated.slice().sort((a, b) => Number(a.out) - Number(b.out) || b.stack - a.stack || (b.bustOrder ?? 0) - (a.bustOrder ?? 0));
  let rank = 0;
  return sorted.map((s, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.out !== s.out || prev.stack !== s.stack || (s.out && prev.bustOrder !== s.bustOrder)) rank = i + 1;
    return { id: s.id, name: s.name, stack: s.stack, rank };
  });
}

// ───────────────────────── client view (no secrets) ─────────────────────────

export interface SeatView {
  seat: number;
  id: string;
  name: string;
  avatar: string;
  photo: string | null;
  color: string;
  stack: number;
  bot: boolean;
  out: boolean;
  connected: boolean;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  bet: number;
  lastAction?: string;
  /** Only your own cards, or everyone's who reached showdown. Otherwise the number of face-down cards. */
  hole: string[] | null;
  cardsDown: number;
  isButton: boolean;
  isSB: boolean;
  isBB: boolean;
}

export interface TableView {
  seats: (SeatView | null)[];
  hand: null | {
    no: number;
    street: Street;
    board: string[];
    pot: number;
    currentBet: number;
    toAct: number | null;
    sb: number;
    bb: number;
    result?: {
      pots: { amount: number; winners: string[]; hand?: string }[];
      shown: { id: string; hole: string[]; hand: string; cards: string[] }[];
      winnings: Record<string, number>;
      uncontested: boolean;
    };
    log: string[];
  };
  you: { seat: number | null; legal: Legal | null };
  blinds: { sb: number; bb: number; levelHands: number; handsPlayed: number };
  winner: { id: string; name: string } | null;
}

const code = (c: Card) => `${c.rank === 14 ? "A" : c.rank === 13 ? "K" : c.rank === 12 ? "Q" : c.rank === 11 ? "J" : c.rank === 10 ? "T" : c.rank}${c.suit}`;

export function viewFor(t: Table, viewerId: string | null): TableView {
  const h = t.hand;
  const showdown = h?.street === "showdown" && h.result && !h.result.uncontested;
  const shownIds = new Set(showdown ? h!.result!.shown.map((s) => s.id) : []);
  const mySeat = viewerId ? t.seats.findIndex((s) => s?.id === viewerId) : -1;
  const seats = t.seats.map((s, i): SeatView | null => {
    if (!s) return null;
    const hp = h ? handPlayer(h, i) : undefined;
    const mine = s.id === viewerId;
    const reveal = !!hp && (mine || shownIds.has(s.id));
    return {
      seat: i,
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      photo: s.photo,
      color: s.color,
      stack: s.stack,
      bot: s.bot,
      out: s.out,
      connected: s.connected,
      inHand: !!hp,
      folded: !!hp?.folded,
      allIn: !!hp?.allIn,
      bet: hp?.bet ?? 0,
      lastAction: hp?.lastAction,
      hole: reveal ? hp!.hole.map(code) : null,
      cardsDown: hp && !hp.folded && !reveal ? hp.hole.length : 0,
      isButton: !!h && h.buttonSeat === i,
      isSB: !!h && h.sbSeat === i,
      isBB: !!h && h.bbSeat === i,
    };
  });
  const w = tableWinner(t);
  return {
    seats,
    hand: h
      ? {
          no: h.no,
          street: h.street,
          board: h.board.map(code),
          pot: potTotal(h),
          currentBet: h.currentBet,
          toAct: h.toAct,
          sb: h.sb,
          bb: h.bb,
          result: h.result
            ? {
                pots: h.result.pots.map((p) => ({ amount: p.amount, winners: p.winners, hand: p.hand })),
                shown: h.result.shown.map((s) => ({ id: s.id, hole: s.hole.map(code), hand: s.hand.name, cards: s.hand.cards.map(code) })),
                winnings: h.result.winnings,
                uncontested: h.result.uncontested,
              }
            : undefined,
          log: h.log.slice(-12),
        }
      : null,
    you: { seat: mySeat >= 0 ? mySeat : null, legal: mySeat >= 0 ? legalActions(t, mySeat) : null },
    blinds: { sb: t.sb, bb: t.bb, levelHands: t.levelHands, handsPlayed: t.handsPlayed },
    winner: w && (!h || h.street === "showdown") ? { id: w.id, name: w.name } : null,
  };
}
