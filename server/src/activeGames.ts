import type { ModeId } from "@/lib/engine/modes";
import type { Env } from "./index";

/**
 * The `active_games` record: which table each player has a game running at.
 * Writes go through a secret-guarded database function; every call returns
 * the live table code per requested user (absent when they're free).
 */
export async function syncActiveGames(
  env: Env,
  op: "set" | "clear" | "get",
  users: string[] | null,
  table?: { code: string; mode?: ModeId; ranked?: boolean },
): Promise<Record<string, string>> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sync_active_games`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_secret: env.TABLE_SERVER_SECRET,
      p_op: op,
      p_code: table?.code ?? "",
      p_mode: table?.mode ?? null,
      p_ranked: table?.ranked ?? null,
      p_users: users,
    }),
  });
  if (!res.ok) throw new Error(`active games ${op} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, string>;
}

/** The table a player is mid-game at, or null. Fails open: a database hiccup shouldn't lock anyone out. */
export async function activeTableOf(env: Env, userId: string): Promise<string | null> {
  try {
    return (await syncActiveGames(env, "get", [userId]))[userId] ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}
