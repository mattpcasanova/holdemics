export type Position = "SB" | "BB" | "UTG" | "MP" | "CO" | "D";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardBackVariant = "default";
export type CardBackState = "active" | "folded" | "out";

export type PlayerStatus = "active" | "folded" | "out" | "acting";

export interface Player {
  id: string;
  name: string;
  initials: string;
  hp: number;
  maxHp: number;
  bbs: number;
  position: Position;
  status: PlayerStatus;
  isHero: boolean;
  inPot?: number;
  cards?: [Card, Card];
}

export interface GameState {
  id: string;
  handNumber: number;
  orbit: number;
  blinds: { sb: number; bb: number };
  nextBlinds: { sb: number; bb: number };
  handsUntilBlindUp: number;
  pot: number;
  communityCards: Card[];
  street: "preflop" | "flop" | "turn" | "river";
  players: Player[];
  mode: "standard" | "turbo" | "slow";
  startingHp: number;
}

export interface PlacementEntry {
  rank: number;
  name: string;
  hp: number;
  bbs: number;
  isHero: boolean;
}

export interface ActionLogEntry {
  text: string;
  type: "action" | "divider" | "highlight";
}

export interface GameMode {
  name: string;
  bbs: number;
  description: string;
  duration: string;
  playerCount: string;
  badge: { text: string; color: "felt" | "gold" | "gray" };
}

export interface RecentGame {
  placement: number;
  mode: string;
  bbs: number;
  duration: string;
  playerCount: number;
  ratingChange: number;
  timeAgo: string;
}

export interface Friend {
  name: string;
  initials: string;
  status: "online" | "offline" | "at-table";
  statusText: string;
  rating: number;
}

export interface BlindSchedule {
  handsPerLevel: number; // standard=12, turbo=8, slow=18
}
