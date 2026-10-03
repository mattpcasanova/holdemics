import { type Rarity, CARD_BACKS, TABLE_SKINS, TITLES } from "./cosmetics";
import { HandCategory } from "./engine/evaluator";
import type { ModeId } from "./engine/modes";
import { STARTING_STACK, UNITS_PER_HP } from "./engine/modes";
import { placementGames } from "./rating";
import { TIERS, TOP_TIER_CUT } from "./tiers";

/**
 * Achievement definitions and the rules that award them. Each one has a
 * rarity and exactly one reward (a title, card back, or table skin); the
 * rarer the achievement, the better the reward. The table server gathers
 * `GameFacts` per player and evaluates the rules at game end; milestone
 * rules also use the player's ranked totals.
 */

export type AchievementCategory = "comeback" | "domination" | "bounty" | "table" | "moves" | "luck" | "milestone" | "tier";

export type Reward = { kind: "title"; id: string } | { kind: "cardBack"; id: string } | { kind: "table"; id: string };

/** Running totals a progress bar can measure (career counts and ranked totals). */
export type ProgressStat = "bluffs" | "pots72" | "allInWins" | "rankedGames" | "rankedWins" | "headsUpWins" | "winStreak";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: Rarity;
  reward: Reward;
  glyph: "♠" | "♥" | "♦" | "♣";
  /** For "do it N times" achievements: which total to measure and the goal. */
  progress?: { stat: ProgressStat; target: number };
}

/** Everything a rule might want to know about one player's game. */
export interface GameFacts {
  mode: ModeId;
  ranked: boolean;
  players: number;
  place: number;
  handsPlayed: number;
  /** Lowest stack held at any hand start, in units. */
  minStack: number;
  /** Chip leader at the start of every hand from four players left onward. */
  ledFromFinalFour: boolean;
  /** Chip leader from when half the field (or fewer) remained. */
  ledFromHalf: boolean;
  /** Chip leader at every hand start after the first knockout. */
  ledSinceFirstBust: boolean;
  knockouts: number;
  /** Best hand category lost at showdown (null if none). */
  worstShowdownLoss: HandCategory | null;
  /** Won an all-in showdown while covered by an opponent. */
  survivedAllInShort: boolean;
  /** Pots won holding 7-2, and whether one of those went to showdown. */
  pots72: number;
  won72Showdown: boolean;
  /** Pots won by betting a better hand off it (see handFacts.ts). */
  bluffs: number;
  /** A bluff with 10% equity or less, made on the flop or turn. */
  stoneColdBluff: boolean;
  /** Biggest pot (units) won with a bluff; 0 if none. */
  biggestBluffPot: number;
  /** A bluff where the bet that got the fold was all in. */
  shoveBluff: boolean;
  /** Showdowns won where someone was all in. */
  allInWins: number;
  /** Lowest equity (0–1) at which they got all in with cards to come and won; null if never. */
  bestSuckout: number | null;
  /** Highest equity at which they got all in with cards to come and lost; null if never. */
  worstBeat: number | null;
}

/** Counts summed over every eligible game (ranked, or private with no bots). */
export interface CareerTotals {
  bluffs: number;
  pots72: number;
  allInWins: number;
}

/** Ranked totals after the game, for milestones. */
export interface PlayerTotals {
  rankedGames: number;
  rankedWins: number;
  headsUpWins: number;
  /** Current run of consecutive ranked wins, including this game. */
  winStreak: number;
  rating: number;
  rank: number | null;
}

const title = (id: string): Reward => ({ kind: "title", id });
const back = (id: string): Reward => ({ kind: "cardBack", id });
const table = (id: string): Reward => ({ kind: "table", id });

export const ACHIEVEMENTS: Achievement[] = [
  // Comeback
  { id: "comeback_1", name: "Comeback", description: "Win a game after being down to 25 HP or less.", category: "comeback", rarity: "uncommon", reward: title("comeback_kid"), glyph: "♥" },
  { id: "comeback_2", name: "Great Escape", description: "Win a game after being down to 10 HP or less.", category: "comeback", rarity: "rare", reward: back("emerald"), glyph: "♥" },
  { id: "comeback_3", name: "Back from the Dead", description: "Win a game after being down to 3 HP or less.", category: "comeback", rarity: "legendary", reward: title("undead"), glyph: "♥" },
  // Domination
  { id: "domination_1", name: "Domination", description: "Win an 8-player game as chip leader from the final four onward.", category: "domination", rarity: "uncommon", reward: title("dominant"), glyph: "♠" },
  { id: "domination_2", name: "Iron Grip", description: "Win an 8-player game as chip leader from the halfway point onward.", category: "domination", rarity: "rare", reward: back("royal"), glyph: "♠" },
  { id: "domination_3", name: "Wire to Wire", description: "Win an 8-player game as chip leader from the first knockout onward.", category: "domination", rarity: "epic", reward: table("ember"), glyph: "♠" },
  // Bounty
  { id: "bounty_1", name: "Bounty Hunter", description: "Knock out three players in one game.", category: "bounty", rarity: "common", reward: title("bounty_hunter"), glyph: "♣" },
  { id: "bounty_2", name: "Executioner", description: "Knock out five players in one game.", category: "bounty", rarity: "rare", reward: title("executioner"), glyph: "♣" },
  { id: "bounty_3", name: "Table Captain", description: "Knock out seven players in one game.", category: "bounty", rarity: "legendary", reward: back("foil"), glyph: "♣" },
  // At the table
  { id: "clean_sweep", name: "Clean Sweep", description: "Win without ever dropping below your starting 100 HP.", category: "table", rarity: "rare", reward: title("untouchable"), glyph: "♦" },
  { id: "cooler_1", name: "Cooler", description: "Lose a showdown holding a full house or better.", category: "table", rarity: "uncommon", reward: title("ran_bad"), glyph: "♥" },
  { id: "cooler_2", name: "Ice Cold", description: "Lose a showdown holding four of a kind or better.", category: "table", rarity: "epic", reward: back("phantom"), glyph: "♥" },
  { id: "houdini", name: "Houdini", description: "Win an all-in showdown while covered, then go on to win the game.", category: "table", rarity: "uncommon", reward: title("escape_artist"), glyph: "♦" },
  // Moves
  { id: "hammer_1", name: "The Hammer", description: "Win a pot holding 7-2.", category: "moves", rarity: "uncommon", reward: title("the_hammer"), glyph: "♣" },
  { id: "hammer_2", name: "Hammer Time", description: "Win a showdown holding 7-2.", category: "moves", rarity: "rare", reward: title("hammer_time"), glyph: "♣" },
  { id: "hammer_3", name: "Sledgehammer", description: "Win 10 pots holding 7-2.", category: "moves", rarity: "epic", reward: title("sledgehammer"), glyph: "♣", progress: { stat: "pots72", target: 10 } },
  { id: "hammer_4", name: "Mjölnir", description: "Win 100 pots holding 7-2.", category: "moves", rarity: "legendary", reward: title("god_of_thunder"), glyph: "♣", progress: { stat: "pots72", target: 100 } },
  { id: "bluff_stone", name: "Stone Cold", description: "Bluff a better hand off the pot on the flop or turn with 10% equity or less.", category: "moves", rarity: "rare", reward: title("stone_cold"), glyph: "♠" },
  { id: "bluff_big", name: "Big Bluff", description: "Win a pot of 50 HP or more with a bluff.", category: "moves", rarity: "epic", reward: title("fearless"), glyph: "♠" },
  { id: "bluff_shove", name: "Nerves of Steel", description: "Bluff a better hand off the pot by going all in.", category: "moves", rarity: "rare", reward: title("nerves_of_steel"), glyph: "♠" },
  { id: "bluff_game", name: "Smoke and Mirrors", description: "Pull off three bluffs in one game.", category: "moves", rarity: "uncommon", reward: title("illusionist"), glyph: "♠" },
  { id: "bluff_1", name: "Bluffer", description: "Pull off 10 bluffs.", category: "moves", rarity: "uncommon", reward: title("bluffer"), glyph: "♠", progress: { stat: "bluffs", target: 10 } },
  { id: "bluff_2", name: "Con Artist", description: "Pull off 50 bluffs.", category: "moves", rarity: "rare", reward: title("con_artist"), glyph: "♠", progress: { stat: "bluffs", target: 50 } },
  { id: "bluff_3", name: "Poker Face", description: "Pull off 200 bluffs.", category: "moves", rarity: "epic", reward: title("poker_face"), glyph: "♠", progress: { stat: "bluffs", target: 200 } },
  // Luck
  { id: "allin_1", name: "Shove It", description: "Win 10 all-in showdowns.", category: "luck", rarity: "uncommon", reward: title("risk_taker"), glyph: "♦", progress: { stat: "allInWins", target: 10 } },
  { id: "allin_2", name: "High Roller", description: "Win 50 all-in showdowns.", category: "luck", rarity: "rare", reward: title("high_roller"), glyph: "♦", progress: { stat: "allInWins", target: 50 } },
  { id: "allin_3", name: "Living Dangerously", description: "Win 250 all-in showdowns.", category: "luck", rarity: "epic", reward: title("daredevil"), glyph: "♦", progress: { stat: "allInWins", target: 250 } },
  { id: "suckout_1", name: "Suckout", description: "Win an all-in with 25% equity or less.", category: "luck", rarity: "common", reward: title("lucky"), glyph: "♦" },
  { id: "suckout_2", name: "Miracle", description: "Win an all-in with 10% equity or less.", category: "luck", rarity: "rare", reward: title("miracle_worker"), glyph: "♦" },
  { id: "suckout_3", name: "Divine Intervention", description: "Win an all-in with 3% equity or less.", category: "luck", rarity: "legendary", reward: title("chosen_one"), glyph: "♦" },
  { id: "badbeat_1", name: "Bad Beat", description: "Lose an all-in with 80% equity or more.", category: "luck", rarity: "common", reward: title("snakebit"), glyph: "♥" },
  { id: "badbeat_2", name: "Brutal Beat", description: "Lose an all-in with 90% equity or more.", category: "luck", rarity: "uncommon", reward: title("cursed"), glyph: "♥" },
  { id: "badbeat_3", name: "Rigged", description: "Lose an all-in with 97% equity or more.", category: "luck", rarity: "rare", reward: title("its_rigged"), glyph: "♥" },
  // Milestones
  { id: "ship_it", name: "Ship It", description: "Win your first ranked game.", category: "milestone", rarity: "common", reward: title("ship_it"), glyph: "♠" },
  { id: "heater", name: "Heater", description: "Win three ranked games in a row.", category: "milestone", rarity: "rare", reward: title("on_a_heater"), glyph: "♥", progress: { stat: "winStreak", target: 3 } },
  { id: "unstoppable", name: "Unstoppable", description: "Win five ranked games in a row.", category: "milestone", rarity: "epic", reward: table("ocean"), glyph: "♥", progress: { stat: "winStreak", target: 5 } },
  { id: "reps_10", name: "Getting Reps", description: "Play 10 ranked games.", category: "milestone", rarity: "common", reward: title("regular"), glyph: "♣", progress: { stat: "rankedGames", target: 10 } },
  { id: "hours_50", name: "Put in the Hours", description: "Play 50 ranked games.", category: "milestone", rarity: "uncommon", reward: table("velvet"), glyph: "♣", progress: { stat: "rankedGames", target: 50 } },
  { id: "century", name: "Century", description: "Play 100 ranked games.", category: "milestone", rarity: "rare", reward: title("centurion"), glyph: "♣", progress: { stat: "rankedGames", target: 100 } },
  { id: "lifer", name: "Lifer", description: "Play 500 ranked games.", category: "milestone", rarity: "legendary", reward: table("goldroom"), glyph: "♣", progress: { stat: "rankedGames", target: 500 } },
  { id: "duelist", name: "Duelist", description: "Win 10 ranked Heads-Up games.", category: "milestone", rarity: "uncommon", reward: title("duelist"), glyph: "♠", progress: { stat: "headsUpWins", target: 10 } },
  { id: "gunslinger", name: "Gunslinger", description: "Win 50 ranked Heads-Up games.", category: "milestone", rarity: "epic", reward: title("gunslinger"), glyph: "♠", progress: { stat: "headsUpWins", target: 50 } },
  // Tiers
  { id: "tier_grinder", name: "Made Grinder", description: "Reach the Grinder tier in any mode.", category: "tier", rarity: "common", reward: title("grinder"), glyph: "♦" },
  { id: "tier_pro", name: "Made Pro", description: "Reach the Pro tier in any mode.", category: "tier", rarity: "uncommon", reward: title("pro"), glyph: "♦" },
  { id: "tier_crusher", name: "Made Crusher", description: "Reach the Crusher tier in any mode.", category: "tier", rarity: "rare", reward: title("crusher"), glyph: "♦" },
  { id: "tier_shark", name: "Made Shark", description: "Reach the Shark tier in any mode.", category: "tier", rarity: "epic", reward: title("shark"), glyph: "♦" },
  { id: "tier_nuts", name: "The Nuts", description: `Hold a top-${TOP_TIER_CUT} spot on any leaderboard.`, category: "tier", rarity: "legendary", reward: title("the_nuts"), glyph: "♠" },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function rewardName(reward: Reward): string {
  if (reward.kind === "title") return `Title: ${TITLES[reward.id]?.text ?? reward.id}`;
  if (reward.kind === "cardBack") return `Card back: ${CARD_BACKS[reward.id]?.name ?? reward.id}`;
  return `Table: ${TABLE_SKINS[reward.id]?.name ?? reward.id}`;
}

const tierMin = (id: string) => TIERS.find((t) => t.id === id)!.min;

/**
 * Achievements earned from one game. Practice and any table with bots never
 * count, so nothing can be farmed against a Rookie.
 */
export function gameAchievements(f: GameFacts): string[] {
  const out: string[] = [];
  const won = f.place === 1;
  const hp = (n: number) => n * UNITS_PER_HP;
  if (won && f.minStack <= hp(25)) out.push("comeback_1");
  if (won && f.minStack <= hp(10)) out.push("comeback_2");
  if (won && f.minStack <= hp(3)) out.push("comeback_3");
  if (won && f.players >= 8 && f.ledFromFinalFour) out.push("domination_1");
  if (won && f.players >= 8 && f.ledFromHalf) out.push("domination_2");
  if (won && f.players >= 8 && f.ledSinceFirstBust) out.push("domination_3");
  if (f.knockouts >= 3) out.push("bounty_1");
  if (f.knockouts >= 5) out.push("bounty_2");
  if (f.knockouts >= 7) out.push("bounty_3");
  if (won && f.minStack >= STARTING_STACK && f.handsPlayed >= 5) out.push("clean_sweep");
  if (f.worstShowdownLoss !== null && f.worstShowdownLoss >= HandCategory.FullHouse) out.push("cooler_1");
  if (f.worstShowdownLoss !== null && f.worstShowdownLoss >= HandCategory.Quads) out.push("cooler_2");
  if (won && f.survivedAllInShort) out.push("houdini");
  if (f.pots72 >= 1) out.push("hammer_1");
  if (f.won72Showdown) out.push("hammer_2");
  if (f.stoneColdBluff) out.push("bluff_stone");
  if (f.biggestBluffPot >= hp(50)) out.push("bluff_big");
  if (f.shoveBluff) out.push("bluff_shove");
  if (f.bluffs >= 3) out.push("bluff_game");
  if (f.bestSuckout !== null && f.bestSuckout <= 0.25) out.push("suckout_1");
  if (f.bestSuckout !== null && f.bestSuckout <= 0.1) out.push("suckout_2");
  if (f.bestSuckout !== null && f.bestSuckout <= 0.03) out.push("suckout_3");
  if (f.worstBeat !== null && f.worstBeat >= 0.8) out.push("badbeat_1");
  if (f.worstBeat !== null && f.worstBeat >= 0.9) out.push("badbeat_2");
  if (f.worstBeat !== null && f.worstBeat >= 0.97) out.push("badbeat_3");
  return out;
}

/**
 * The subset of game achievements that can be awarded the moment they happen,
 * before anyone knows who wins (everything that doesn't look at placement).
 */
export function inGameAchievements(f: GameFacts): string[] {
  return gameAchievements({ ...f, place: Number.POSITIVE_INFINITY });
}

/** Achievements from counts summed across eligible games. */
export function careerAchievements(t: CareerTotals): string[] {
  const out: string[] = [];
  if (t.bluffs >= 10) out.push("bluff_1");
  if (t.bluffs >= 50) out.push("bluff_2");
  if (t.bluffs >= 200) out.push("bluff_3");
  if (t.allInWins >= 10) out.push("allin_1");
  if (t.allInWins >= 50) out.push("allin_2");
  if (t.allInWins >= 250) out.push("allin_3");
  if (t.pots72 >= 10) out.push("hammer_3");
  if (t.pots72 >= 100) out.push("hammer_4");
  return out;
}

/** Milestone and tier achievements from a player's ranked totals after a game. */
export function milestoneAchievements(t: PlayerTotals, mode: ModeId): string[] {
  const out: string[] = [];
  if (t.rankedWins >= 1) out.push("ship_it");
  if (t.winStreak >= 3) out.push("heater");
  if (t.winStreak >= 5) out.push("unstoppable");
  if (t.rankedGames >= 10) out.push("reps_10");
  if (t.rankedGames >= 50) out.push("hours_50");
  if (t.rankedGames >= 100) out.push("century");
  if (t.rankedGames >= 500) out.push("lifer");
  if (t.headsUpWins >= 10) out.push("duelist");
  if (t.headsUpWins >= 50) out.push("gunslinger");
  const placed = t.rankedGames >= placementGames(mode);
  if (placed) {
    if (t.rating >= tierMin("grinder")) out.push("tier_grinder");
    if (t.rating >= tierMin("pro")) out.push("tier_pro");
    if (t.rating >= tierMin("crusher")) out.push("tier_crusher");
    if (t.rating >= tierMin("shark")) out.push("tier_shark");
    if (t.rank !== null && t.rank <= TOP_TIER_CUT) out.push("tier_nuts");
  }
  return out;
}
