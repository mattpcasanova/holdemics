export type Suit = "s" | "h" | "d" | "c";
/** 2–14, where 11=J, 12=Q, 13=K, 14=A */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ["s", "h", "d", "c"];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_LABELS: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

const RANK_NAMES: Record<Rank, [string, string]> = {
  2: ["Two", "Twos"], 3: ["Three", "Threes"], 4: ["Four", "Fours"],
  5: ["Five", "Fives"], 6: ["Six", "Sixes"], 7: ["Seven", "Sevens"],
  8: ["Eight", "Eights"], 9: ["Nine", "Nines"], 10: ["Ten", "Tens"],
  11: ["Jack", "Jacks"], 12: ["Queen", "Queens"], 13: ["King", "Kings"],
  14: ["Ace", "Aces"],
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

export function rankName(rank: Rank, plural = false): string {
  return RANK_NAMES[rank][plural ? 1 : 0];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "h" || suit === "d";
}

/** Parse "As", "Td", "10h" etc. Mostly for tests. */
export function parseCard(text: string): Card {
  const suit = text.slice(-1) as Suit;
  const r = text.slice(0, -1).toUpperCase();
  const map: Record<string, Rank> = { T: 10, "10": 10, J: 11, Q: 12, K: 13, A: 14 };
  const rank = (map[r] ?? Number(r)) as Rank;
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) throw new Error(`Bad card: ${text}`);
  return { rank, suit };
}

export function parseCards(text: string): Card[] {
  return text.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function cardKey(card: Card): string {
  return `${RANK_LABELS[card.rank]}${card.suit}`;
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

/** Mulberry32 — small, fast, seedable PRNG. Returns a function yielding [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
