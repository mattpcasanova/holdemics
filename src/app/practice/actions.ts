"use server";

import { BOT_LEVELS, type BotLevel } from "@/lib/engine/bots";
import { MODES, type ModeId } from "@/lib/engine/modes";
import { createClient, getViewer } from "@/lib/supabase/server";

export interface PracticeResult {
  mode: ModeId;
  botLevel: BotLevel;
  place: number;
  players: number;
  hands: number;
}

/** Saves a finished practice game to the signed-in player's history. Guests are ignored. */
export async function recordPracticeGame(result: PracticeResult): Promise<{ saved: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { saved: false };

  const { mode, botLevel, place, players, hands } = result;
  const valid =
    mode in MODES &&
    botLevel in BOT_LEVELS &&
    players === MODES[mode].seats &&
    Number.isInteger(place) &&
    place >= 1 &&
    place <= players &&
    Number.isInteger(hands) &&
    hands >= 0 &&
    hands < 10_000;
  if (!valid) return { saved: false };

  const supabase = await createClient();
  const { error } = await supabase.from("practice_games").insert({
    user_id: viewer.id,
    mode,
    bot_level: botLevel,
    place,
    players,
    hands,
  });
  return { saved: !error };
}
