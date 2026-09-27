/**
 * Cosmetic registries. Everything is unlocked for now; later each skin gets
 * an unlock rule (achievement, rank, or purchase) and players pick from what
 * they own.
 */

export type BackPattern = "lattice" | "dots" | "sunburst" | "chevron";
export type BackEmblem = "spade" | "monogram" | "crown" | "star";

export interface CardBackSkin {
  id: string;
  name: string;
  base: string;
  pattern: BackPattern;
  patternColor: string;
  frame: string;
  emblemBg: string;
  emblemFg: string;
  emblem: BackEmblem;
}

export const CARD_BACKS: Record<string, CardBackSkin> = {
  classic: {
    id: "classic",
    name: "Tournament felt",
    base: "#1B6143",
    pattern: "lattice",
    patternColor: "rgba(229,185,106,0.35)",
    frame: "#E5B96A",
    emblemBg: "#0F2E21",
    emblemFg: "#E5B96A",
    emblem: "spade",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    base: "#18284A",
    pattern: "dots",
    patternColor: "rgba(156,190,255,0.4)",
    frame: "#C9D6F2",
    emblemBg: "#0C1528",
    emblemFg: "#C9D6F2",
    emblem: "star",
  },
  crimson: {
    id: "crimson",
    name: "Crimson royale",
    base: "#7A1E24",
    pattern: "chevron",
    patternColor: "rgba(255,226,196,0.28)",
    frame: "#F3DDBF",
    emblemBg: "#3F0C10",
    emblemFg: "#F3DDBF",
    emblem: "crown",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    base: "#15171B",
    pattern: "sunburst",
    patternColor: "rgba(229,185,106,0.3)",
    frame: "#E5B96A",
    emblemBg: "#E5B96A",
    emblemFg: "#15171B",
    emblem: "monogram",
  },
};

export interface ChipFace {
  /** Main chip color. */
  base: string;
  /** Edge inserts ("spots") around the rim. */
  stripe: string;
  /** Center inlay. */
  inlay: string;
}

export interface ChipSkin {
  id: string;
  name: string;
  /** One face per denomination in CHIP_DENOMS_HP, low to high. */
  faces: ChipFace[];
}

/** Chip denominations in HP. */
export const CHIP_DENOMS_HP = [0.5, 1, 5, 25, 100];

export const CHIP_SETS: Record<string, ChipSkin> = {
  classic: {
    id: "classic",
    name: "Casino classic",
    faces: [
      { base: "#8FC3E8", stripe: "#FFFFFF", inlay: "#D9ECF8" },
      { base: "#EDEAE3", stripe: "#2F6FB5", inlay: "#FFFFFF" },
      { base: "#C8323A", stripe: "#FFFFFF", inlay: "#F2D7D8" },
      { base: "#1E8A4C", stripe: "#FFFFFF", inlay: "#D5EEDD" },
      { base: "#1C1E22", stripe: "#E5B96A", inlay: "#3A3D44" },
    ],
  },
  highroller: {
    id: "highroller",
    name: "High roller",
    faces: [
      { base: "#3A3D44", stripe: "#C9CDD4", inlay: "#55595F" },
      { base: "#26282D", stripe: "#E8EAED", inlay: "#3A3D44" },
      { base: "#5B2A86", stripe: "#E5B96A", inlay: "#7A48A6" },
      { base: "#8A6E2E", stripe: "#F6E3B4", inlay: "#B8944A" },
      { base: "#0E1013", stripe: "#E5B96A", inlay: "#E5B96A" },
    ],
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    faces: [
      { base: "#F2C38B", stripe: "#FFFFFF", inlay: "#F9E1C4" },
      { base: "#F28B66", stripe: "#FFF4E8", inlay: "#F8C4B0" },
      { base: "#D9486A", stripe: "#FFE7EE", inlay: "#EC9DB0" },
      { base: "#8C3E9E", stripe: "#FFD8F6", inlay: "#B77CC4" },
      { base: "#2E2A5A", stripe: "#F2C38B", inlay: "#4B4685" },
    ],
  },
};

const AVATAR_TONES = [
  { bg: "#2E4A3D", fg: "#9FCFB6" },
  { bg: "#4A3B24", fg: "#E5B96A" },
  { bg: "#3A2F4A", fg: "#C3B2E6" },
  { bg: "#24404A", fg: "#9CCBDB" },
  { bg: "#4A2A2A", fg: "#E1A3A3" },
  { bg: "#3D4224", fg: "#CED69A" },
  { bg: "#2B3342", fg: "#AFC0DD" },
  { bg: "#472B3E", fg: "#DFA7C9" },
];

export function avatarTone(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function initialsFor(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 _]/g, "").split(/[ _]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
