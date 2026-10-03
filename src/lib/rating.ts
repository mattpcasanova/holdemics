import type { ModeId } from "./engine/modes";

/**
 * Placement rating via pairwise Elo: each finish is scored as a win against
 * everyone placed below and a loss to everyone placed above. With equal
 * ratings in an 8-player lobby this yields +35/+25/+15/+5/-5/-15/-25/-35,
 * and it scales automatically with lobby strength.
 */

export interface RatedEntry {
  id: string;
  rating: number;
  /** 1 = winner. */
  place: number;
  gamesPlayed: number;
}

/** Total K spread across all opponents. Pairwise K = kTotal / (n - 1). */
const K_TOTAL_MULTI = 70;
const K_TOTAL_HEADS_UP = 32;
const PROVISIONAL_MULTIPLIER = 2;

/**
 * Placement games before a rating settles. An 8-player finish is seven
 * pairwise results at once, so multi-player modes need fewer games.
 */
export function placementGames(mode: ModeId): number {
  return mode === "headsup" ? 20 : 10;
}

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function ratingChanges(entries: RatedEntry[], mode: ModeId = entries.length === 2 ? "headsup" : "standard"): Record<string, number> {
  const n = entries.length;
  if (n < 2) return Object.fromEntries(entries.map((e) => [e.id, 0]));
  const kPair = (n === 2 ? K_TOTAL_HEADS_UP : K_TOTAL_MULTI) / (n - 1);
  const provisionalBelow = placementGames(mode);

  const out: Record<string, number> = {};
  for (const me of entries) {
    let delta = 0;
    for (const them of entries) {
      if (them === me) continue;
      const actual = me.place < them.place ? 1 : me.place > them.place ? 0 : 0.5;
      delta += kPair * (actual - expectedScore(me.rating, them.rating));
    }
    if (me.gamesPlayed < provisionalBelow) delta *= PROVISIONAL_MULTIPLIER;
    out[me.id] = Math.round(delta);
  }
  return out;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Rating change by place (index 0 = 1st) in a lobby where everyone has the same rating. */
export function evenLobbyPayouts(players: number): number[] {
  const entries = Array.from({ length: players }, (_, i) => ({
    id: String(i),
    rating: 1500,
    place: i + 1,
    gamesPlayed: 999,
  }));
  const deltas = ratingChanges(entries);
  return entries.map((e) => deltas[e.id]);
}

/**
 * Hands a player may spend away (disconnected or sitting out) in a ranked
 * game before they lose any claim to the top half. Roughly 40% of a typical
 * game: Standard runs ~33 hands, Turbo ~25, Heads-Up ~21.
 */
export function abandonHands(mode: ModeId): number {
  return mode === "standard" ? 12 : mode === "turbo" ? 10 : 8;
}

/**
 * Rated places after the away penalty: a player who was away too long can do
 * no better than the first place in the bottom half (5th of 8, 2nd of 2).
 * They drop just below that spot and everyone they passed moves up one.
 */
export function penalizeAbandoned<T extends { place: number; abandoned: boolean }>(entries: T[]): T[] {
  const cap = Math.floor(entries.length / 2) + 1;
  const byPlace = [...entries].sort((a, b) => a.place - b.place);
  const demoted = byPlace.filter((e) => e.abandoned && e.place < cap);
  const rest = byPlace.filter((e) => !demoted.includes(e));
  // Everyone else keeps their order; the demoted block starts the bottom half.
  const order = [...rest.slice(0, cap - 1), ...demoted, ...rest.slice(cap - 1)];
  return entries.map((e) => ({ ...e, place: order.indexOf(e) + 1 }));
}
