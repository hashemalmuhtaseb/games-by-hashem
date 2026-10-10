/**
 * Cards and Texas Hold'em hand evaluation.
 *
 * A hand's strength is a score vector [category, ...tiebreak ranks]; comparing two vectors
 * lexicographically gives the winner, and equal vectors split the pot. Suits never break ties.
 */

export type Suit = "c" | "d" | "h" | "s";
export interface Card {
  rank: number; // 2..14 (11 J, 12 Q, 13 K, 14 A)
  suit: Suit;
}

export const SUITS: Suit[] = ["c", "d", "h", "s"];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit });
  return d;
}

/** Fisher–Yates with an injectable integer source (crypto.randomInt on the server). */
export function shuffleDeck(deck: Card[], randInt: (maxExclusive: number) => number): Card[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const RANK_CHARS: Record<number, string> = { 10: "T", 11: "J", 12: "Q", 13: "K", 14: "A" };
export function cardCode(c: Card): string {
  return `${RANK_CHARS[c.rank] ?? String(c.rank)}${c.suit}`;
}
export function parseCard(code: string): Card {
  const r = code.slice(0, -1).toUpperCase();
  const s = code.slice(-1).toLowerCase() as Suit;
  const rank = r === "A" ? 14 : r === "K" ? 13 : r === "Q" ? 12 : r === "J" ? 11 : r === "T" || r === "10" ? 10 : Number(r);
  if (!SUITS.includes(s) || !(rank >= 2 && rank <= 14)) throw new Error(`bad card ${code}`);
  return { rank, suit: s };
}
export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).map(parseCard);

export enum Category {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export const CATEGORY_NAMES: Record<Category, string> = {
  [Category.HighCard]: "High Card",
  [Category.OnePair]: "One Pair",
  [Category.TwoPair]: "Two Pair",
  [Category.ThreeOfAKind]: "Three of a Kind",
  [Category.Straight]: "Straight",
  [Category.Flush]: "Flush",
  [Category.FullHouse]: "Full House",
  [Category.FourOfAKind]: "Four of a Kind",
  [Category.StraightFlush]: "Straight Flush",
  [Category.RoyalFlush]: "Royal Flush",
};

export interface HandValue {
  score: number[];
  category: Category;
  name: string;
  /** The five cards that make the hand. */
  cards: Card[];
}

/** Highest card of a straight in these ranks (5 for the A-2-3-4-5 wheel), or 0. */
function straightHigh(ranksDesc: number[]): number {
  const u = [...new Set(ranksDesc)];
  if (u.length !== 5) return 0;
  if (u[0] - u[4] === 4) return u[0];
  if (u[0] === 14 && u[1] === 5 && u[4] === 2) return 5;
  return 0;
}

export function evaluate5(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error("evaluate5 needs 5 cards");
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const sh = straightHigh(ranks);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Groups ordered by size then rank: [[rank,count],...]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const order = groups.map((g) => g[0]);
  let category: Category;
  let tiebreak: number[];
  if (flush && sh) {
    category = sh === 14 ? Category.RoyalFlush : Category.StraightFlush;
    tiebreak = [sh];
  } else if (groups[0][1] === 4) {
    category = Category.FourOfAKind;
    tiebreak = order;
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = Category.FullHouse;
    tiebreak = order;
  } else if (flush) {
    category = Category.Flush;
    tiebreak = ranks;
  } else if (sh) {
    category = Category.Straight;
    tiebreak = [sh];
  } else if (groups[0][1] === 3) {
    category = Category.ThreeOfAKind;
    tiebreak = order;
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = Category.TwoPair;
    tiebreak = order;
  } else if (groups[0][1] === 2) {
    category = Category.OnePair;
    tiebreak = order;
  } else {
    category = Category.HighCard;
    tiebreak = ranks;
  }
  // Royal flush shares the straight-flush ordering (it is simply the ace-high one).
  const scoreCat = category === Category.RoyalFlush ? Category.StraightFlush : category;
  return { score: [scoreCat, ...tiebreak], category, name: CATEGORY_NAMES[category], cards: sortForDisplay(cards, category, sh) };
}

function sortForDisplay(cards: Card[], cat: Category, sh: number): Card[] {
  const byRank = cards.slice().sort((a, b) => b.rank - a.rank);
  if ((cat === Category.Straight || cat === Category.StraightFlush) && sh === 5) return [...byRank.slice(1), byRank[0]];
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  return byRank.sort((a, b) => counts.get(b.rank)! - counts.get(a.rank)! || b.rank - a.rank);
}

export function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Best five-card hand from five to seven cards. */
export function bestHand(cards: Card[]): HandValue {
  if (cards.length < 5) throw new Error("need at least 5 cards");
  let best: HandValue | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const v = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareScores(v.score, best.score) > 0) best = v;
          }
  return best!;
}
