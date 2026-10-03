import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeId } from "./engine/modes";

/** A player's career ranked record in one mode (from the `ranked_summary` RPC). */
export interface RankedSummary {
  games: number;
  wins: number;
  /** Top-half finishes: top 4 of 8. In heads-up this equals wins. */
  topHalf: number;
  avgPlace: number | null;
}

export const EMPTY_SUMMARY: RankedSummary = { games: 0, wins: 0, topHalf: 0, avgPlace: null };

export const winRate = (s: RankedSummary) => (s.games ? s.wins / s.games : null);
export const topHalfRate = (s: RankedSummary) => (s.games ? s.topHalf / s.games : null);

/** Heads-Up has no "top 4": its top half is the win, so only multi-player modes show it. */
export const showsTopHalf = (mode: ModeId) => mode !== "headsup";

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** Summaries keyed by user id, then mode. Works with either the browser or server client. */
export async function fetchRankedSummaries(
  supabase: SupabaseClient,
  userIds: string[],
  mode?: ModeId,
): Promise<Record<string, Partial<Record<ModeId, RankedSummary>>>> {
  if (!userIds.length) return {};
  const { data } = await supabase.rpc("ranked_summary", { p_users: userIds, p_mode: mode ?? null });
  const out: Record<string, Partial<Record<ModeId, RankedSummary>>> = {};
  for (const r of (data ?? []) as { user_id: string; mode: ModeId; games: number; wins: number; top_half: number; avg_place: number | string | null }[]) {
    (out[r.user_id] ??= {})[r.mode] = { games: r.games, wins: r.wins, topHalf: r.top_half, avgPlace: r.avg_place === null ? null : Number(r.avg_place) };
  }
  return out;
}
