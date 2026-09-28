import { HandCategory } from "./engine/evaluator";
import type { ModeId } from "./engine/modes";
import { STARTING_STACK, UNITS_PER_HP } from "./engine/modes";
import { placementGames } from "./rating";
import { TIERS, TOP_TIER_CUT } from "./tiers";

/**
 * Achievement definitions and the rules that award them. The table server
 * gathers `GameFacts` for each player over a game and evaluates the rules at
 * the end; milestone rules also look at the player's ranked totals. All of
 * it is plain data so it can be unit-tested without a table.
 */

export type AchievementCategory = "game" | "milestone" | "tier";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** Card-suit glyph used as the badge mark. */
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
  knockouts: number;
  /** Best hand category lost at showdown (null if none). */
  worstShowdownLoss: HandCategory | null;
  /** Won a hand at showdown after being all-in. */
  survivedAllIn: boolean;
}

/** Ranked totals after the game, for milestones. */
export interface PlayerTotals {
  rankedGames: number;
  rankedWins: number;
  headsUpWins: number;
  rating: number;
  rank: number | null;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_blood", name: "First Blood", description: "Win your first ranked game.", category: "milestone", glyph: "♠" },
  { id: "comeback", name: "Comeback", description: "Win a game after being down to 10 HP or less.", category: "game", glyph: "♥" },
  { id: "domination", name: "Domination", description: "Win an 8-player game as chip leader from the final four onward.", category: "game", glyph: "♠" },
  { id: "clean_sweep", name: "Clean Sweep", description: "Win without ever dropping below your starting 100 HP.", category: "game", glyph: "♦" },
  { id: "bully", name: "Bully", description: "Knock out four players in one game.", category: "game", glyph: "♣" },
  { id: "cooler", name: "Cooler", description: "Lose a showdown holding a full house or better.", category: "game", glyph: "♥" },
  { id: "houdini", name: "Houdini", description: "Win a showdown after going all-in and go on to win the game.", category: "game", glyph: "♦" },
  { id: "regular_10", name: "Regular", description: "Play 10 ranked games.", category: "milestone", glyph: "♣" },
  { id: "grinder_50", name: "Put in the Hours", description: "Play 50 ranked games.", category: "milestone", glyph: "♣" },
  { id: "century", name: "Century", description: "Play 100 ranked games.", category: "milestone", glyph: "♣" },
  { id: "headsup_10", name: "Duelist", description: "Win 10 ranked Heads-Up games.", category: "milestone", glyph: "♠" },
  { id: "tier_grinder", name: "Grinder", description: "Reach the Grinder tier in any mode.", category: "tier", glyph: "♦" },
  { id: "tier_pro", name: "Pro", description: "Reach the Pro tier in any mode.", category: "tier", glyph: "♦" },
  { id: "tier_crusher", name: "Crusher", description: "Reach the Crusher tier in any mode.", category: "tier", glyph: "♦" },
  { id: "tier_shark", name: "Shark", description: "Reach the Shark tier in any mode.", category: "tier", glyph: "♦" },
  { id: "tier_nuts", name: "The Nuts", description: `Hold a top-${TOP_TIER_CUT} spot on any leaderboard.`, category: "tier", glyph: "♠" },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

const tierMin = (id: string) => TIERS.find((t) => t.id === id)!.min;

/**
 * Achievements earned from one game. Practice and any table with bots never
 * count, so nothing can be farmed against a Rookie.
 */
export function gameAchievements(f: GameFacts): string[] {
  const out: string[] = [];
  const won = f.place === 1;
  if (won && f.minStack <= 10 * UNITS_PER_HP) out.push("comeback");
  if (won && f.players === 8 && f.ledFromFinalFour) out.push("domination");
  if (won && f.minStack >= STARTING_STACK && f.handsPlayed > 0) out.push("clean_sweep");
  if (f.knockouts >= 4) out.push("bully");
  if (f.worstShowdownLoss !== null && f.worstShowdownLoss >= HandCategory.FullHouse) out.push("cooler");
  if (won && f.survivedAllIn) out.push("houdini");
  return out;
}

/** Milestone and tier achievements from a player's ranked totals after a game. */
export function milestoneAchievements(t: PlayerTotals, mode: ModeId): string[] {
  const out: string[] = [];
  if (t.rankedWins >= 1) out.push("first_blood");
  if (t.rankedGames >= 10) out.push("regular_10");
  if (t.rankedGames >= 50) out.push("grinder_50");
  if (t.rankedGames >= 100) out.push("century");
  if (t.headsUpWins >= 10) out.push("headsup_10");
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
