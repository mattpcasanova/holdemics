import { BOT_LEVELS, type BotLevel } from "../engine/bots";
import { MODES, type ModeId } from "../engine/modes";
import { createClient, getViewer } from "../supabase/server";

export interface PracticeResult {
  mode: ModeId;
  botLevel: BotLevel;
  place: number;
  players: number;
  hands: number;
}

export function isPracticeResult(value: unknown): value is PracticeResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const mode = r.mode as ModeId;
  return (
    typeof mode === "string" &&
    mode in MODES &&
    typeof r.botLevel === "string" &&
    r.botLevel in BOT_LEVELS &&
    r.players === MODES[mode].seats &&
    Number.isInteger(r.place) &&
    (r.place as number) >= 1 &&
    (r.place as number) <= MODES[mode].seats &&
    Number.isInteger(r.hands) &&
    (r.hands as number) >= 0 &&
    (r.hands as number) < 10_000
  );
}

/** Saves a finished practice game to the signed-in player's history. Guests are ignored. */
export async function recordPracticeGame(result: PracticeResult): Promise<{ saved: boolean; reason?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { saved: false, reason: "guest" };
  const supabase = await createClient();
  const { error } = await supabase.from("practice_games").insert({
    user_id: viewer.id,
    mode: result.mode,
    bot_level: result.botLevel,
    place: result.place,
    players: result.players,
    hands: result.hands,
  });
  return error ? { saved: false, reason: error.message } : { saved: true };
}
