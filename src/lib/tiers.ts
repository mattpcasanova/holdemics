import type { ModeId } from "./engine/modes";
import { placementGames } from "./rating";

/**
 * The rank ladder, named after player archetypes from the one nobody fears
 * to the one everybody does. The top tier is a leaderboard cut, not a rating
 * threshold. Players are Unranked until their placement games are done.
 */
export interface Tier {
  id: string;
  name: string;
  /** Minimum rating for the tier (ignored for the leaderboard tier). */
  min: number;
  blurb: string;
  color: string;
}

export const TIERS: Tier[] = [
  { id: "fish", name: "Fish", min: -Infinity, blurb: "Gets caught", color: "#5BA3D9" },
  { id: "station", name: "Calling Station", min: 1200, blurb: "Never folds, never raises", color: "#7FB3C9" },
  { id: "nit", name: "Nit", min: 1350, blurb: "Waits for aces", color: "#A7ADB4" },
  { id: "reg", name: "Reg", min: 1450, blurb: "Solid, unremarkable", color: "#6FA68A" },
  { id: "grinder", name: "Grinder", min: 1550, blurb: "Puts in the hours", color: "#4FA877" },
  { id: "pro", name: "Pro", min: 1700, blurb: "Plays for a living", color: "#C9A25A" },
  { id: "crusher", name: "Crusher", min: 1850, blurb: "Beats the game", color: "#E5B96A" },
  { id: "shark", name: "Shark", min: 2000, blurb: "Hunts the table", color: "#E07A5A" },
];

export const TOP_TIER: Tier = { id: "nuts", name: "The Nuts", min: Infinity, blurb: "The best hand there is", color: "#F0C877" };
export const TOP_TIER_CUT = 50;

export const UNRANKED: Tier = { id: "unranked", name: "Unranked", min: -Infinity, blurb: "Placement games in progress", color: "#6B7178" };

export function tierFor(mode: ModeId, rating: number, games: number, rank: number | null): Tier {
  if (games < placementGames(mode)) return UNRANKED;
  if (rank !== null && rank <= TOP_TIER_CUT) return TOP_TIER;
  let tier = TIERS[0];
  for (const t of TIERS) if (rating >= t.min) tier = t;
  return tier;
}

/** The next tier up and how far away it is, for progress displays. */
export function nextTier(tier: Tier, rating: number): { tier: Tier; pointsAway: number } | null {
  if (tier === TOP_TIER || tier === UNRANKED) return null;
  const i = TIERS.indexOf(tier);
  const next = TIERS[i + 1];
  return next ? { tier: next, pointsAway: next.min - rating } : null;
}
