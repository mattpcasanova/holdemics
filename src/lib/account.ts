import type { BotLevel } from "./engine/bots";
import type { ModeId } from "./engine/modes";
import { createClient, getViewer } from "./supabase/server";

export interface Profile {
  id: string;
  username: string;
  avatar: string;
}

export interface Rating {
  mode: ModeId;
  rating: number;
  peak: number;
  games: number;
}

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
  recentPractice: PracticeGame[];
  /** When this snapshot was loaded; used for "2h ago" labels. */
  loadedAt: number;
}

/** Everything the lobby shows about the signed-in player, or null for guests. */
export async function getAccount(): Promise<Account | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const [profile, ratings, practice] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar").eq("id", viewer.id).maybeSingle(),
    supabase.from("ratings").select("mode, rating, peak, games").eq("user_id", viewer.id),
    supabase
      .from("practice_games")
      .select("id, mode, bot_level, place, players, hands, played_at")
      .eq("user_id", viewer.id)
      .order("played_at", { ascending: false })
      .limit(8),
  ]);
  if (!profile.data) return null;
  return {
    profile: profile.data as Profile,
    ratings: (ratings.data ?? []) as Rating[],
    recentPractice: (practice.data ?? []) as PracticeGame[],
    loadedAt: Date.now(),
  };
}
