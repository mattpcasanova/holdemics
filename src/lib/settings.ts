"use client";

import { createLocalStore } from "./localStore";

export type DeckStyle = "two-color" | "four-color" | "full-color";

export interface Settings {
  deckStyle: DeckStyle;
  cardBack: string;
  chips: string;
  /** Enforce the decision clock in practice games. */
  practiceClock: boolean;
  sound: boolean;
  /** 0–1 */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  deckStyle: "four-color",
  cardBack: "classic",
  chips: "classic",
  practiceClock: true,
  sound: true,
  volume: 0.6,
};

export const settingsStore = createLocalStore<Settings>("holdemics:settings", DEFAULT_SETTINGS);
export const useSettings = settingsStore.use;
