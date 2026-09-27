"use client";

import { createLocalStore } from "./localStore";

export type PlayerTag = "fish" | "whale" | "nit" | "reg" | "shark" | "maniac";

export const PLAYER_TAGS: Record<PlayerTag, { label: string; color: string; hint: string }> = {
  fish: { label: "Fish", color: "#5BA3D9", hint: "Weak, calls too much" },
  whale: { label: "Whale", color: "#8E7CE0", hint: "Plays huge pots loosely" },
  nit: { label: "Nit", color: "#A7ADB4", hint: "Very tight, only premiums" },
  reg: { label: "Reg", color: "#6FA68A", hint: "Solid, standard player" },
  shark: { label: "Shark", color: "#E5B96A", hint: "Strong, avoid marginal spots" },
  maniac: { label: "Maniac", color: "#E07A5A", hint: "Hyper-aggressive, bluffs a lot" },
};

export const TAG_ORDER: PlayerTag[] = ["fish", "whale", "nit", "reg", "shark", "maniac"];

export interface PlayerNote {
  tag: PlayerTag | null;
  note: string;
  updatedAt: number;
}

export const notesStore = createLocalStore<Record<string, PlayerNote>>("holdemics:notes", {});
export const useNotes = notesStore.use;

/** Bots are regenerated each game, so their notes key off the name. */
export function noteKey(player: { id: string; name: string; isBot: boolean }): string {
  return player.isBot ? `bot:${player.name}` : `user:${player.id}`;
}

export function saveNote(key: string, patch: Partial<Omit<PlayerNote, "updatedAt">>) {
  notesStore.set((prev) => {
    const current = prev[key] ?? { tag: null, note: "", updatedAt: 0 };
    const next = { ...current, ...patch, updatedAt: Date.now() };
    const out = { ...prev, [key]: next };
    if (!next.tag && !next.note.trim()) delete out[key];
    return out;
  });
}
