import { type Card, type Rank, rankName } from "./cards";

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

export interface HandValue {
  /** Higher is better; comparable across any two hands. */
  score: number;
  category: HandCategory;
  /** Rank values that define the hand, most significant first. */
  ranks: Rank[];
}

const SUIT_INDEX = { s: 0, h: 1, d: 2, c: 3 } as const;

function encode(category: HandCategory, ranks: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 15 + (ranks[i] ?? 0);
  return score;
}

/** Highest straight in a rank bitmask (bit n = rank n, ace also counts as 1). Returns 0 if none. */
function straightHigh(mask: number): number {
  if (mask & (1 << 14)) mask |= 1 << 1;
  for (let high = 14; high >= 5; high--) {
    const run = 0b11111 << (high - 4);
    if ((mask & run) === run) return high;
  }
  return 0;
}

function topRanks(mask: number, count: number, exclude: number[] = []): number[] {
  const out: number[] = [];
  for (let r = 14; r >= 2 && out.length < count; r--) {
    if (mask & (1 << r) && !exclude.includes(r)) out.push(r);
  }
  return out;
}

/** Evaluate the best 5-card hand from 5–7 cards. */
export function evaluate(cards: Card[]): HandValue {
  const counts = new Array<number>(15).fill(0);
  const suitCounts = [0, 0, 0, 0];
  const suitMasks = [0, 0, 0, 0];
  let rankMask = 0;

  for (const c of cards) {
    counts[c.rank]++;
    const si = SUIT_INDEX[c.suit];
    suitCounts[si]++;
    suitMasks[si] |= 1 << c.rank;
    rankMask |= 1 << c.rank;
  }

  const make = (category: HandCategory, ranks: number[]): HandValue => ({
    score: encode(category, ranks),
    category,
    ranks: ranks as Rank[],
  });

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMasks[flushSuit]);
    if (sf) return make(HandCategory.StraightFlush, [sf]);
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
  }

  if (quads.length) {
    return make(HandCategory.Quads, [quads[0], ...topRanks(rankMask, 1, [quads[0]])]);
  }

  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return make(HandCategory.FullHouse, [trips[0], pairRank]);
  }

  if (flushSuit >= 0) return make(HandCategory.Flush, topRanks(suitMasks[flushSuit], 5));

  const straight = straightHigh(rankMask);
  if (straight) return make(HandCategory.Straight, [straight]);

  if (trips.length) {
    return make(HandCategory.Trips, [trips[0], ...topRanks(rankMask, 2, [trips[0]])]);
  }

  if (pairs.length >= 2) {
    const [hi, lo] = pairs;
    return make(HandCategory.TwoPair, [hi, lo, ...topRanks(rankMask, 1, [hi, lo])]);
  }

  if (pairs.length) {
    return make(HandCategory.Pair, [pairs[0], ...topRanks(rankMask, 3, [pairs[0]])]);
  }

  return make(HandCategory.HighCard, topRanks(rankMask, 5));
}

export function describeHand(value: HandValue): string {
  const [a, b] = value.ranks;
  switch (value.category) {
    case HandCategory.StraightFlush:
      return a === 14 ? "Royal Flush" : `Straight Flush, ${rankName(a)} high`;
    case HandCategory.Quads:
      return `Four of a Kind, ${rankName(a, true)}`;
    case HandCategory.FullHouse:
      return `Full House, ${rankName(a, true)} full of ${rankName(b, true)}`;
    case HandCategory.Flush:
      return `Flush, ${rankName(a)} high`;
    case HandCategory.Straight:
      return `Straight, ${rankName(a)} high`;
    case HandCategory.Trips:
      return `Three of a Kind, ${rankName(a, true)}`;
    case HandCategory.TwoPair:
      return `Two Pair, ${rankName(a, true)} and ${rankName(b, true)}`;
    case HandCategory.Pair:
      return `Pair of ${rankName(a, true)}`;
    default:
      return `${rankName(a)} High`;
  }
}
