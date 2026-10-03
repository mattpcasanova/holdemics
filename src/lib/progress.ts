import type { ProgressStat } from "./achievements";
import { createClient } from "./supabase/server";

/** Current value of every progress stat for one player, for achievement progress bars. */
export async function getProgressTotals(userId: string): Promise<Record<ProgressStat, number>> {
  const supabase = await createClient();
  const [statsRes, gamesRes] = await Promise.all([
    supabase.from("player_game_stats").select("bluffs, pots72, all_in_wins").eq("user_id", userId),
    supabase.from("ranked_games").select("mode, place").eq("user_id", userId).order("played_at", { ascending: false }),
  ]);
  const stats = statsRes.data ?? [];
  const games = gamesRes.data ?? [];
  const sum = (key: "bluffs" | "pots72" | "all_in_wins") => stats.reduce((n, r) => n + (r[key] ?? 0), 0);
  const firstLoss = games.findIndex((g) => g.place !== 1);
  return {
    bluffs: sum("bluffs"),
    pots72: sum("pots72"),
    allInWins: sum("all_in_wins"),
    rankedGames: games.length,
    rankedWins: games.filter((g) => g.place === 1).length,
    headsUpWins: games.filter((g) => g.place === 1 && g.mode === "headsup").length,
    // Newest first, so the current streak runs until the first non-win.
    winStreak: firstLoss === -1 ? games.length : firstLoss,
  };
}
