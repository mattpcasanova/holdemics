import { createClient } from "./supabase/server";

const MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Server-side: the online game this player is still in (see `active_games`), or null. */
export async function getActiveGame(userId: string): Promise<{ code: string; mode: string; ranked: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("active_games").select("table_code, mode, ranked, started_at").eq("user_id", userId).maybeSingle();
  if (!data || Date.now() - new Date(data.started_at).getTime() > MAX_AGE_MS) return null;
  return { code: data.table_code, mode: data.mode, ranked: data.ranked };
}
