"use client";

import { createLocalStore } from "./localStore";

export type DeckStyle = "two-color" | "four-color" | "full-color";

export interface Settings {
  deckStyle: DeckStyle;
  cardBack: string;
  chips: string;
  /** Enforce the decision clock in practice games. */
  practiceClock: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  deckStyle: "four-color",
  cardBack: "classic",
  chips: "classic",
  practiceClock: true,
};

export const settingsStore = createLocalStore<Settings>("holdemics:settings", DEFAULT_SETTINGS);
export const useSettings = settingsStore.use;
