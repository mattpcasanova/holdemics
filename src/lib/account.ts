import type { BotLevel } from "./engine/bots";
import type { ModeId } from "./engine/modes";
import { createClient, getViewer } from "./supabase/server";

export interface Profile {
  id: string;
  username: string;
  avatar: string;
  /** Selected title id, or null. */
  title: string | null;
}

export interface Rating {
  mode: ModeId;
  rating: number;
  peak: number;
  games: number;
  /** Leaderboard position in the mode, once placed. */
  rank: number | null;
}

export interface RankedGame {
  id: number;
  table_code: string;
  mode: ModeId;
  place: number;
  players: number;
  hands: number;
  rating_before: number;
  rating_after: number;
  played_at: string;
}

/** Practice and ranked results merged for the history list. */
export type GameRecord =
  | ({ kind: "practice" } & PracticeGame)
  | ({ kind: "ranked" } & RankedGame);

export interface PracticeGame {
  id: number;
  mode: ModeId;
  bot_level: BotLevel;
  place: number;
  players: number;
  hands: number;
  played_at: string;
}

export interface Account {
  profile: Profile;
  ratings: Rating[];
  /** Rating after each of the last ranked games per mode, oldest first (starts with the rating before the first). */
  trend: Partial<Record<ModeId, number[]>>;
  recentPractice: PracticeGame[];
  recent: GameRecord[];
  /** When this snapshot was loaded; used for "2h ago" labels. */
  loadedAt: number;
}

/** Everything the lobby shows about the signed-in player, or null for guests. */
export async function getAccount(): Promise<Account | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const [profile, ratings, practice, ranked, history] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar, title").eq("id", viewer.id).maybeSingle(),
    supabase.from("ratings").select("mode, rating, peak, games").eq("user_id", viewer.id),
    supabase
      .from("practice_games")
      .select("id, mode, bot_level, place, players, hands, played_at")
      .eq("user_id", viewer.id)
      .order("played_at", { ascending: false })
      .limit(8),
    supabase
      .from("ranked_games")
      .select("id, table_code, mode, place, players, hands, rating_before, rating_after, played_at")
      .eq("user_id", viewer.id)
      .order("played_at", { ascending: false })
      .limit(8),
    supabase
      .from("ranked_games")
      .select("mode, rating_before, rating_after, played_at")
      .eq("user_id", viewer.id)
      .order("played_at", { ascending: false })
      .limit(60),
  ]);
  if (!profile.data) return null;

  const trend: Partial<Record<ModeId, number[]>> = {};
  for (const row of [...((history.data ?? []) as { mode: ModeId; rating_before: number; rating_after: number }[])].reverse()) {
    const series = trend[row.mode] ?? (trend[row.mode] = [row.rating_before]);
    if (series.length < 21) series.push(row.rating_after);
  }

  const ratingRows = (ratings.data ?? []) as Omit<Rating, "rank">[];
  const ranks = await Promise.all(
    ratingRows.map(async (r) => {
      if (r.games === 0) return null;
      const { data } = await supabase.rpc("mode_rank", { p_mode: r.mode, p_user: viewer.id });
      return typeof data === "number" ? data : null;
    }),
  );

  const recentPractice = (practice.data ?? []) as PracticeGame[];
  const recentRanked = (ranked.data ?? []) as RankedGame[];
  const recent: GameRecord[] = [
    ...recentPractice.map((g) => ({ kind: "practice" as const, ...g })),
    ...recentRanked.map((g) => ({ kind: "ranked" as const, ...g })),
  ]
    .sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at))
    .slice(0, 8);

  return {
    profile: profile.data as Profile,
    ratings: ratingRows.map((r, i) => ({ ...r, rank: ranks[i] })),
    trend,
    recentPractice,
    recent,
    loadedAt: Date.now(),
  };
}
