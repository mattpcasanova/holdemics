"use client";

import type { Reward } from "./achievements";
import { settingsStore } from "./settings";
import { createClient } from "./supabase/client";
import { unlocksStore } from "./unlocks";

/** Whether this reward is what the player currently has on. */
export function isEquipped(reward: Reward): boolean {
  if (reward.kind === "title") return unlocksStore.get().title === reward.id;
  if (reward.kind === "cardBack") return settingsStore.get().cardBack === reward.id;
  return settingsStore.get().tableSkin === reward.id;
}

/**
 * Put on a reward that was just earned. The server has already granted it,
 * so it's added to the local unlocks too (Settings would otherwise show it
 * locked until the next sign-in). Returns an error message on failure.
 */
export async function equipReward(reward: Reward): Promise<string | null> {
  const unlocks = unlocksStore.get();
  if (!unlocks.owned.some((o) => o.kind === reward.kind && o.item_id === reward.id)) {
    unlocksStore.set({ owned: [...unlocks.owned, { kind: reward.kind, item_id: reward.id }] });
  }
  if (reward.kind === "cardBack") {
    settingsStore.set({ cardBack: reward.id });
    return null;
  }
  if (reward.kind === "table") {
    settingsStore.set({ tableSkin: reward.id });
    return null;
  }
  const prev = unlocks.title;
  unlocksStore.set({ title: reward.id });
  if (!unlocks.userId) return null;
  const { error } = await createClient().from("profiles").update({ title: reward.id }).eq("id", unlocks.userId);
  if (!error) return null;
  unlocksStore.set({ title: prev });
  return "Couldn't put that title on.";
}
