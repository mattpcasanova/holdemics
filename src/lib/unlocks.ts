"use client";

import { createLocalStore } from "./localStore";

/**
 * What the signed-in player has unlocked and which title they wear. Filled
 * by AccountSync from `player_cosmetics` and `profiles.title`; guests own
 * only the defaults.
 */
export interface Unlocks {
  userId: string | null;
  username: string | null;
  owned: { kind: string; item_id: string }[];
  title: string | null;
  avatar: string;
  loaded: boolean;
}

export const DEFAULT_UNLOCKS: Unlocks = { userId: null, username: null, owned: [], title: null, avatar: "initials", loaded: false };

export const unlocksStore = createLocalStore<Unlocks>("holdemics:unlocks", DEFAULT_UNLOCKS);
export const useUnlocks = unlocksStore.use;
