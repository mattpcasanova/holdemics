import type { ModeId } from "./engine/modes";
import { type RankedSummary, EMPTY_SUMMARY, fetchRankedSummaries } from "./rankedStats";
import { createClient } from "./supabase/server";

/** Everything public about one player, for /u/<username>. */

export interface PublicProfile {
  id: string;
  username: string;
  avatar: string;
  title: string | null;
  joinedAt: string;
}

export interface ModeSummary {
  mode: ModeId;
  rating: number;
  peak: number;
  /** Ranked games in this mode (from the ratings row, which counts placement games too). */
  games: number;
  rank: number | null;
  /** Career ranked record (all games, not just the recent ones loaded for the trend). */
  record: RankedSummary;
  /** Rating before the first of the recent games, then after each; oldest first. */
  trend: number[];
}

export interface ProfileGame {
  id: number;
  mode: ModeId;
  place: number;
  players: number;
  ratingBefore: number;
  ratingAfter: number;
  playedAt: string;
}

export interface ProfileFriend {
  id: string;
  username: string;
  avatar: string;
  title: string | null;
}

export type Relationship = "self" | "none" | "friends" | "outgoing" | "incoming" | "guest";

export interface ProfileData {
  profile: PublicProfile;
  modes: ModeSummary[];
  recent: ProfileGame[];
  achievements: { id: string; earnedAt: string }[];
  friends: ProfileFriend[];
  relationship: Relationship;
}

const MODE_ORDER: ModeId[] = ["standard", "turbo", "headsup"];
const TREND_POINTS = 30;
const HISTORY_LIMIT = 1000;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

/** Load a profile by username (case-insensitive). Null if there's no such player. */
export async function getProfile(username: string, viewerId: string | null): Promise<ProfileData | null> {
  if (!USERNAME.test(username)) return null;
  const supabase = await createClient();
  // Underscore is a LIKE wildcard; escape it so ilike is an exact, case-insensitive match.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar, title, created_at")
    .ilike("username", username.replace(/_/g, "\\_"))
    .maybeSingle();
  if (!profile) return null;
  const id = profile.id as string;

  const [ratings, games, achievements, friends, link] = await Promise.all([
    supabase.from("ratings").select("mode, rating, peak, games").eq("user_id", id),
    supabase
      .from("ranked_games")
      .select("id, mode, place, players, rating_before, rating_after, played_at")
      .eq("user_id", id)
      .order("played_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from("player_achievements").select("achievement_id, earned_at").eq("user_id", id).order("earned_at", { ascending: false }),
    supabase.rpc("profile_friends", { p_user: id }),
    viewerId && viewerId !== id
      ? supabase
          .from("friend_requests")
          .select("from_id, status")
          .or(`and(from_id.eq.${viewerId},to_id.eq.${id}),and(from_id.eq.${id},to_id.eq.${viewerId})`)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const history: ProfileGame[] = ((games.data ?? []) as {
    id: number;
    mode: ModeId;
    place: number;
    players: number;
    rating_before: number;
    rating_after: number;
    played_at: string;
  }[]).map((g) => ({
    id: g.id,
    mode: g.mode,
    place: g.place,
    players: g.players,
    ratingBefore: g.rating_before,
    ratingAfter: g.rating_after,
    playedAt: g.played_at,
  }));

  const records = (await fetchRankedSummaries(supabase, [id]))[id] ?? {};
  const ratingRows = (ratings.data ?? []) as { mode: ModeId; rating: number; peak: number; games: number }[];
  const modes = await Promise.all(
    MODE_ORDER.map(async (mode): Promise<ModeSummary> => {
      const row = ratingRows.find((r) => r.mode === mode) ?? { mode, rating: 1500, peak: 1500, games: 0 };
      const mine = history.filter((g) => g.mode === mode);
      const rank =
        row.games > 0 ? await supabase.rpc("mode_rank", { p_mode: mode, p_user: id }).then(({ data }) => (typeof data === "number" ? data : null)) : null;
      const recentFirst = mine.slice(0, TREND_POINTS).reverse();
      return {
        mode,
        rating: row.rating,
        peak: row.peak,
        games: row.games,
        rank,
        record: records[mode] ?? EMPTY_SUMMARY,
        trend: recentFirst.length ? [recentFirst[0].ratingBefore, ...recentFirst.map((g) => g.ratingAfter)] : [],
      };
    }),
  );

  let relationship: Relationship = viewerId ? "none" : "guest";
  if (viewerId === id) relationship = "self";
  const row = link.data as { from_id: string; status: string } | null;
  if (row && relationship === "none") relationship = row.status === "accepted" ? "friends" : row.from_id === viewerId ? "outgoing" : "incoming";

  return {
    profile: { id, username: profile.username, avatar: profile.avatar, title: profile.title ?? null, joinedAt: profile.created_at },
    modes,
    recent: history.slice(0, 10),
    achievements: ((achievements.data ?? []) as { achievement_id: string; earned_at: string }[]).map((a) => ({ id: a.achievement_id, earnedAt: a.earned_at })),
    friends: (friends.data ?? []) as ProfileFriend[],
    relationship,
  };
}
