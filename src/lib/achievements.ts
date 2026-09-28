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

export type AchievementCategory = "comeback" | "domination" | "bounty" | "table" | "milestone" | "tier";

export type Reward = { kind: "title"; id: string } | { kind: "cardBack"; id: string } | { kind: "table"; id: string };

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: Rarity;
  reward: Reward;
  glyph: "♠" | "♥" | "♦" | "♣";
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
  { id: "cooler_2", name: "Bad Beat", description: "Lose a showdown holding four of a kind or better.", category: "table", rarity: "epic", reward: back("phantom"), glyph: "♥" },
  { id: "houdini", name: "Houdini", description: "Win an all-in showdown while covered, then go on to win the game.", category: "table", rarity: "uncommon", reward: title("escape_artist"), glyph: "♦" },
  // Milestones
  { id: "ship_it", name: "Ship It", description: "Win your first ranked game.", category: "milestone", rarity: "common", reward: title("ship_it"), glyph: "♠" },
  { id: "heater", name: "Heater", description: "Win three ranked games in a row.", category: "milestone", rarity: "rare", reward: title("on_a_heater"), glyph: "♥" },
  { id: "unstoppable", name: "Unstoppable", description: "Win five ranked games in a row.", category: "milestone", rarity: "epic", reward: table("ocean"), glyph: "♥" },
  { id: "reps_10", name: "Getting Reps", description: "Play 10 ranked games.", category: "milestone", rarity: "common", reward: title("regular"), glyph: "♣" },
  { id: "hours_50", name: "Put in the Hours", description: "Play 50 ranked games.", category: "milestone", rarity: "uncommon", reward: table("velvet"), glyph: "♣" },
  { id: "century", name: "Century", description: "Play 100 ranked games.", category: "milestone", rarity: "rare", reward: title("centurion"), glyph: "♣" },
  { id: "lifer", name: "Lifer", description: "Play 500 ranked games.", category: "milestone", rarity: "legendary", reward: table("goldroom"), glyph: "♣" },
  { id: "duelist", name: "Duelist", description: "Win 10 ranked Heads-Up games.", category: "milestone", rarity: "uncommon", reward: title("duelist"), glyph: "♠" },
  { id: "gunslinger", name: "Gunslinger", description: "Win 50 ranked Heads-Up games.", category: "milestone", rarity: "epic", reward: title("gunslinger"), glyph: "♠" },
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
