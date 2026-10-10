import { describe, expect, it } from "vitest";
import { bestHand, Category, compareScores, evaluate5, parseCards, type Card } from "@/poker/cards";
import { act, buildPots, createTable, legalActions, seatPlayer, standings, startHand, tableWinner, viewFor, type Table } from "@/poker/table";
import { botDecision } from "@/poker/bot";

const hv = (s: string) => evaluate5(parseCards(s));
const best = (s: string) => bestHand(parseCards(s));
const beats = (a: string, b: string) => compareScores(best(a).score, best(b).score);

describe("hand rankings", () => {
  const cases: [string, Category][] = [
    ["As Ks Qs Js Ts", Category.RoyalFlush],
    ["9h 8h 7h 6h 5h", Category.StraightFlush],
    ["5d 4d 3d 2d Ad", Category.StraightFlush],
    ["Qc Qd Qh Qs 2c", Category.FourOfAKind],
    ["Kc Kd Kh 3s 3c", Category.FullHouse],
    ["Ac Jc 8c 6c 2c", Category.Flush],
    ["Ts 9d 8c 7h 6s", Category.Straight],
    ["5s 4d 3c 2h As", Category.Straight],
    ["7c 7d 7h Ks 2c", Category.ThreeOfAKind],
    ["Jc Jd 4h 4s 9c", Category.TwoPair],
    ["Ac Ad 9h 5s 2c", Category.OnePair],
    ["Ac Qd 9h 5s 2c", Category.HighCard],
  ];
  for (const [cards, cat] of cases) it(`${cards} is ${Category[cat]}`, () => expect(hv(cards).category).toBe(cat));

  it("orders every category correctly", () => {
    const order = cases.map(([c]) => hv(c).score);
    for (let i = 0; i < order.length - 1; i++) expect(compareScores(order[i], order[i + 1])).toBeGreaterThanOrEqual(0);
    expect(compareScores(hv("As Ks Qs Js Ts").score, hv("9h 8h 7h 6h 5h").score)).toBeGreaterThan(0);
  });

  it("names hands", () => {
    expect(hv("As Ks Qs Js Ts").name).toBe("Royal Flush");
    expect(hv("Ac Ad 9h 5s 2c").name).toBe("One Pair");
  });

  it("does not count A-K-Q-J-T plus wraparound as a straight", () => {
    expect(hv("Qs Ks As 2d 3c").category).toBe(Category.HighCard);
  });

  it("finds the best five of seven", () => {
    const v = best("Ah Kh 2c 3d Qh Jh Th");
    expect(v.category).toBe(Category.RoyalFlush);
    expect(best("2c 2d 2h 5s 5c 5d 9h").category).toBe(Category.FullHouse);
    expect(best("2c 2d 2h 5s 5c 5d 9h").score).toEqual([Category.FullHouse, 5, 2]);
  });
});

describe("tie-breaking", () => {
  it("compares kickers", () => {
    expect(beats("Ac Ad Kh 7s 2c 3d 4h", "Ac Ad Qh 7s 2c 3d 4h")).toBeGreaterThan(0);
  });
  it("higher two pair wins, then the kicker", () => {
    expect(beats("Kc Kd 2h 2s 9c", "Qc Qd Jh Js Ac")).toBeGreaterThan(0);
    expect(beats("Kc Kd 2h 2s 9c", "Kh Ks 2d 2c 8c")).toBeGreaterThan(0);
  });
  it("wheel loses to six-high straight", () => {
    expect(beats("5s 4d 3c 2h As", "6s 5d 4c 3h 2s")).toBeLessThan(0);
  });
  it("flush compares all five cards", () => {
    expect(beats("Ac Jc 8c 6c 3c", "Ad Jd 8d 6d 2d")).toBeGreaterThan(0);
  });
  it("full house compares trips first", () => {
    expect(beats("3c 3d 3h 2s 2c", "2c 2d 2h As Ac")).toBeGreaterThan(0);
  });
  it("identical hands from the board tie (suits never break ties)", () => {
    expect(beats("2c 3d Ah Kh Qh Jh Th", "4s 5s Ah Kh Qh Jh Th")).toBe(0);
    expect(beats("Ac Kd Qh Jc 9s", "Ad Kh Qc Jd 9c")).toBe(0);
  });
});

describe("pot building", () => {
  it("makes a side pot for a short all-in", () => {
    const pots = buildPots([
      { id: "a", total: 100, folded: false },
      { id: "b", total: 300, folded: false },
      { id: "c", total: 300, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 300, eligible: ["a", "b", "c"] },
      { amount: 400, eligible: ["b", "c"] },
    ]);
  });
  it("keeps folded chips in the pot but never makes folders eligible", () => {
    const pots = buildPots([
      { id: "a", total: 50, folded: true },
      { id: "b", total: 200, folded: false },
      { id: "c", total: 200, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 450, eligible: ["b", "c"] }]);
  });
  it("returns uncalled chips as a pot only the bettor can win", () => {
    const pots = buildPots([
      { id: "a", total: 500, folded: false },
      { id: "b", total: 200, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 400, eligible: ["a", "b"] },
      { amount: 300, eligible: ["a"] },
    ]);
  });
  it("handles three all-in levels", () => {
    const pots = buildPots([
      { id: "a", total: 50, folded: false },
      { id: "b", total: 150, folded: false },
      { id: "c", total: 400, folded: false },
      { id: "d", total: 400, folded: false },
    ]);
    expect(pots.map((p) => p.amount)).toEqual([200, 300, 500]);
    expect(pots.map((p) => p.eligible)).toEqual([["a", "b", "c", "d"], ["b", "c", "d"], ["c", "d"]]);
  });
});

// ───────────── table simulation helpers ─────────────

/** A random source that deals a chosen sequence: the deck is popped from the end, so we stack it. */
function stacked(t: Table, holes: Record<number, string>, board: string): (n: number) => number {
  // We bypass shuffling: return 0 so Fisher–Yates swaps i with 0, then fix up via setDeck.
  void t;
  void holes;
  void board;
  return () => 0;
}

function rig(t: Table, holes: Record<number, string>, board: string) {
  // Replace the dealt hand's cards after startHand for deterministic tests.
  const h = t.hand!;
  for (const p of h.players) p.hole = parseCards(holes[p.seat]);
  const b = parseCards(board);
  // Deck pops from the end: burn, flop×3, burn, turn, burn, river.
  const filler: Card[] = parseCards("2c 2c 2c");
  h.deck = [b[4], filler[0], b[3], filler[1], b[2], b[1], b[0], filler[2]];
}

function table(stacks: number[], opts: { sb?: number; bb?: number; levelHands?: number } = {}): Table {
  const t = createTable({ maxSeats: 8, sb: opts.sb ?? 5, bb: opts.bb ?? 10, levelHands: opts.levelHands ?? 0 });
  stacks.forEach((s, i) => seatPlayer(t, { id: `p${i}`, name: `P${i}`, avatar: "x", photo: null, color: "#000", stack: s, bot: false }));
  return t;
}

const r0 = () => 0;

describe("table: blinds, order and rotation", () => {
  it("posts blinds left of the button and starts left of the big blind", () => {
    const t = table([1000, 1000, 1000, 1000]);
    t.button = 3; // next hand's button becomes seat 0
    startHand(t, r0);
    const h = t.hand!;
    expect(h.buttonSeat).toBe(0);
    expect(h.sbSeat).toBe(1);
    expect(h.bbSeat).toBe(2);
    expect(h.toAct).toBe(3);
    expect(t.seats[1]!.stack).toBe(995);
    expect(t.seats[2]!.stack).toBe(990);
    expect(h.players.every((p) => p.hole.length === 2)).toBe(true);
    expect(h.deck.length).toBe(52 - 8);
  });

  it("rotates the button each hand", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      startHand(t, r0);
      seen.push(t.hand!.buttonSeat);
      // everyone folds to the big blind
      while (t.hand!.street !== "showdown") act(t, t.hand!.toAct!, { type: "fold" }, r0);
    }
    expect(seen).toEqual([0, 1, 2, 0]);
  });

  it("heads-up: button posts the small blind and acts first pre-flop, last after", () => {
    const t = table([1000, 1000]);
    t.button = 1;
    startHand(t, r0);
    const h = t.hand!;
    expect(h.buttonSeat).toBe(0);
    expect(h.sbSeat).toBe(0);
    expect(h.bbSeat).toBe(1);
    expect(h.toAct).toBe(0);
    act(t, 0, { type: "call" }, r0);
    expect(h.toAct).toBe(1); // big blind's option
    act(t, 1, { type: "check" }, r0);
    expect(h.street).toBe("flop");
    expect(h.toAct).toBe(1); // non-button acts first after the flop
  });

  it("big blind gets the option when everyone limps", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    startHand(t, r0); // button 0, sb 1, bb 2, utg = 0
    act(t, 0, { type: "call" }, r0);
    act(t, 1, { type: "call" }, r0);
    expect(t.hand!.street).toBe("preflop");
    expect(t.hand!.toAct).toBe(2);
    expect(legalActions(t, 2)!.check).toBe(true);
    act(t, 2, { type: "check" }, r0);
    expect(t.hand!.street).toBe("flop");
    expect(t.hand!.toAct).toBe(1); // first active left of the button
  });

  it("doubles the blinds every level", () => {
    const t = table([5000, 5000], { levelHands: 2 });
    t.button = 1;
    for (let i = 0; i < 3; i++) {
      startHand(t, r0);
      while (t.hand!.street !== "showdown") act(t, t.hand!.toAct!, { type: "fold" }, r0);
    }
    expect(t.bb).toBe(20);
    expect(t.sb).toBe(10);
  });
});

describe("table: betting rules", () => {
  it("enforces the minimum raise and reopens only on full raises", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    startHand(t, r0); // utg 0
    expect(legalActions(t, 0)!.minRaiseTo).toBe(20);
    expect(act(t, 0, { type: "raise", to: 15 }, r0).error).toMatch(/minimum/);
    act(t, 0, { type: "raise", to: 40 }, r0); // raise of 30
    expect(legalActions(t, 1)!.minRaiseTo).toBe(70);
  });

  it("an all-in for less than a full raise doesn't reopen betting", () => {
    const t = table([1000, 1000, 75]);
    t.button = 2;
    startHand(t, r0); // btn 0, sb 1, bb 2 (stack 75 → 65 behind); utg = btn 0
    act(t, 0, { type: "raise", to: 50 }, r0); // full raise (40)
    act(t, 1, { type: "call" }, r0);
    act(t, 2, { type: "allin" }, r0); // to 75: raise of 25 < 40 → short all-in
    // Seat 0 already acted and only faces a short all-in: call or fold only.
    const l0 = legalActions(t, 0)!;
    expect(l0.call).toBe(25);
    expect(l0.canRaise).toBe(false);
    expect(act(t, 0, { type: "raise", to: 200 }, r0).error).toBeTruthy();
  });

  it("can't check facing a bet, can't bet more than the stack", () => {
    const t = table([100, 100]);
    t.button = 1;
    startHand(t, r0);
    expect(act(t, 0, { type: "check" }, r0).error).toMatch(/call/);
    expect(act(t, 0, { type: "raise", to: 500 }, r0).error).toMatch(/only have/);
    expect(act(t, 1, { type: "check" }, r0).error).toMatch(/turn/);
  });
});

describe("table: showdown, side pots, split pots", () => {
  it("awards the pot to the best hand at showdown and reveals only live hands", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    startHand(t, r0);
    rig(t, { 0: "Ah Ad", 1: "Kc Kd", 2: "7s 2h" }, "2c 9d Jh 4s 5c");
    act(t, 0, { type: "call" }, r0);
    act(t, 1, { type: "call" }, r0);
    act(t, 2, { type: "fold" }, r0);
    for (let s = 0; s < 3; s++) {
      act(t, t.hand!.toAct!, { type: "check" }, r0);
      act(t, t.hand!.toAct!, { type: "check" }, r0);
    }
    const h = t.hand!;
    expect(h.street).toBe("showdown");
    expect(h.result!.winnings).toEqual({ p0: 30 });
    expect(t.seats[0]!.stack).toBe(1020);
    expect(h.result!.shown.map((s) => s.id).sort()).toEqual(["p0", "p1"]);
    const v = viewFor(t, "p2");
    expect(v.seats[2]!.hole).toEqual(["7s", "2h"]); // my own cards
    expect(v.seats[0]!.hole).toEqual(["Ah", "Ad"]); // revealed at showdown
  });

  it("never exposes opponents' hole cards before showdown", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    startHand(t, r0);
    const v = viewFor(t, "p0");
    const json = JSON.stringify(v);
    const others = t.hand!.players.filter((p) => p.id !== "p0").flatMap((p) => p.hole);
    expect(v.seats[1]!.hole).toBeNull();
    expect(v.seats[1]!.cardsDown).toBe(2);
    expect(v.seats[0]!.hole).toHaveLength(2);
    expect(json).not.toContain("deck");
    // Hole-card codes of opponents must not appear anywhere in the payload.
    for (const c of others) {
      const code = `${c.rank === 14 ? "A" : c.rank === 13 ? "K" : c.rank === 12 ? "Q" : c.rank === 11 ? "J" : c.rank === 10 ? "T" : c.rank}${c.suit}`;
      const mine = t.hand!.players[0].hole.some((m) => m.rank === c.rank && m.suit === c.suit);
      if (!mine) expect(json.includes(`"${code}"`)).toBe(false);
    }
    // Spectators see no hole cards at all.
    const spec = viewFor(t, null);
    expect(spec.seats.every((s) => !s || s.hole === null)).toBe(true);
  });

  it("everyone folds: winner takes the pot without showing", () => {
    const t = table([1000, 1000, 1000]);
    t.button = 2;
    startHand(t, r0);
    act(t, 0, { type: "raise", to: 100 }, r0);
    act(t, 1, { type: "fold" }, r0);
    act(t, 2, { type: "fold" }, r0);
    expect(t.hand!.result!.uncontested).toBe(true);
    expect(t.hand!.result!.shown).toEqual([]);
    expect(t.seats[0]!.stack).toBe(1015);
  });

  it("splits a pot between equal hands and gives the odd chip left of the button", () => {
    const t = table([1000, 1000, 1000], { sb: 5, bb: 10 });
    t.button = 2;
    startHand(t, r0); // btn 0, sb 1, bb 2
    rig(t, { 0: "2c 3c", 1: "2d 3d", 2: "4h 4s" }, "Ah Kh Qh Jh Th");
    // Make a pot of 31: everyone in for 10, plus a stray chip from the BB raise-fold line below.
    act(t, 0, { type: "call" }, r0);
    act(t, 1, { type: "call" }, r0);
    act(t, 2, { type: "check" }, r0);
    while (t.hand!.street !== "showdown") act(t, t.hand!.toAct!, { type: "check" }, r0);
    const res = t.hand!.result!;
    // Royal flush on the board: all three split 30 → 10 each.
    expect(res.pots[0].winners.sort()).toEqual(["p0", "p1", "p2"]);
    expect(res.winnings).toEqual({ p0: 10, p1: 10, p2: 10 });
  });

  it("odd chips go to the first winner left of the button", () => {
    const t = table([1000, 1000, 1000], { sb: 5, bb: 10 });
    t.button = 2;
    startHand(t, r0); // btn 0, sb 1, bb 2
    rig(t, { 0: "2c 3c", 1: "2d 3d", 2: "2h 3h" }, "Ac Kd Qs Jd 9c");
    act(t, 0, { type: "call" }, r0); // 10
    act(t, 1, { type: "fold" }, r0); // 5 dead
    act(t, 2, { type: "check" }, r0);
    while (t.hand!.street !== "showdown") act(t, t.hand!.toAct!, { type: "check" }, r0);
    // 25 chips split by p0 and p2 (both play the board): 12 each, the odd chip to p2, who sits
    // closer to the button's left (seat order after button 0 is 1, 2, 0).
    expect(t.hand!.result!.winnings).toEqual({ p2: 13, p0: 12 });
  });

  it("builds side pots for all-ins and pays each pot to its best eligible hand", () => {
    const t = table([100, 300, 1000]);
    t.button = 2;
    startHand(t, r0); // btn 0 (100), sb 1 (300), bb 2 (1000)
    rig(t, { 0: "Ah Ad", 1: "Kh Kd", 2: "Qh Qd" }, "2c 7d 9s 3h 4c");
    act(t, 0, { type: "allin" }, r0); // 100
    act(t, 1, { type: "allin" }, r0); // 300
    act(t, 2, { type: "call" }, r0); // calls 300
    const h = t.hand!;
    expect(h.street).toBe("showdown"); // board ran out automatically
    expect(h.board).toHaveLength(5);
    const res = h.result!;
    expect(res.pots.map((p) => p.amount)).toEqual([300, 400]);
    expect(res.pots[0].winners).toEqual(["p0"]); // aces win the main pot
    expect(res.pots[1].winners).toEqual(["p1"]); // kings win the side pot
    expect(t.seats[0]!.stack).toBe(300);
    expect(t.seats[1]!.stack).toBe(400);
    expect(t.seats[2]!.stack).toBe(700);
    // Total chips are conserved.
    expect(t.seats.reduce((s, x) => s + (x?.stack ?? 0), 0)).toBe(1400);
  });

  it("returns an uncalled all-in excess and busts the loser", () => {
    const t = table([500, 200]);
    t.button = 1;
    startHand(t, r0); // btn/sb 0 (500), bb 1 (200)
    rig(t, { 0: "2c 7d", 1: "Ah As" }, "Kc Qd 9h 5s 3c");
    act(t, 0, { type: "allin" }, r0); // to 500
    act(t, 1, { type: "call" }, r0); // all-in 200
    const res = t.hand!.result!;
    expect(res.pots.map((p) => p.amount)).toEqual([400, 300]);
    expect(t.seats[1]!.stack).toBe(400);
    expect(t.seats[0]!.stack).toBe(300);
    expect(tableWinner(t)).toBeNull();
  });

  it("declares the last player with chips the winner and ranks busts", () => {
    const t = table([100, 100, 1000]);
    t.button = 2;
    startHand(t, r0);
    rig(t, { 0: "2c 7d", 1: "3c 8d", 2: "Ah As" }, "Kc Qd 9h 5s Jc");
    act(t, 0, { type: "allin" }, r0);
    act(t, 1, { type: "allin" }, r0);
    act(t, 2, { type: "call" }, r0);
    expect(tableWinner(t)?.id).toBe("p2");
    const st = standings(t);
    expect(st[0]).toMatchObject({ id: "p2", rank: 1 });
    // Both busted in the same hand with equal stacks: they share second place.
    expect(st[1].rank).toBe(2);
    expect(st[2].rank).toBe(2);
  });

  it("an all-in blind runs the board out", () => {
    const t = table([1000, 5]);
    t.button = 1;
    startHand(t, r0); // btn/sb 0, bb 1 posts 5 all-in
    // SB has posted 5 which matches; nobody else can bet.
    expect(t.hand!.street).toBe("showdown");
    expect(t.hand!.board).toHaveLength(5);
  });
});

describe("bots", () => {
  it("always choose a legal action", { timeout: 60_000 }, () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const randInt = (n: number) => Math.floor(rnd() * n);
    for (let game = 0; game < 6; game++) {
      const t = table([500, 500, 500, 500]);
      for (let hand = 0; hand < 40 && !tableWinner(t); hand++) {
        startHand(t, randInt);
        let guard = 0;
        while (t.hand!.street !== "showdown" && guard++ < 200) {
          const seat = t.hand!.toAct!;
          const a = botDecision(t, seat, rnd, 16);
          const r = act(t, seat, a, randInt);
          expect(r.error).toBeUndefined();
        }
        expect(t.seats.reduce((s, x) => s + (x?.stack ?? 0), 0)).toBe(2000);
      }
    }
  });
});

void stacked;
