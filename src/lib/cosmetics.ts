/**
 * Cosmetic registries: card backs, chip sets, table skins, and titles.
 * Defaults have no `unlock`; everything else is earned through the
 * achievement whose id is named, and the reward mapping lives with the
 * achievement definitions (src/lib/achievements.ts).
 */

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY: Record<Rarity, { label: string; color: string; order: number }> = {
  common: { label: "Common", color: "#9AA0A6", order: 0 },
  uncommon: { label: "Uncommon", color: "#6FC08F", order: 1 },
  rare: { label: "Rare", color: "#6FA2E6", order: 2 },
  epic: { label: "Epic", color: "#B48BE6", order: 3 },
  legendary: { label: "Legendary", color: "#E5B96A", order: 4 },
};

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
  rarity: Rarity;
  /** Achievement id that unlocks it; undefined means everyone has it. */
  unlock?: string;
}

export const CARD_BACKS: Record<string, CardBackSkin> = {
  classic: { id: "classic", name: "Tournament felt", base: "#1B6143", pattern: "lattice", patternColor: "rgba(229,185,106,0.35)", frame: "#E5B96A", emblemBg: "#0F2E21", emblemFg: "#E5B96A", emblem: "spade", rarity: "common" },
  midnight: { id: "midnight", name: "Midnight", base: "#18284A", pattern: "dots", patternColor: "rgba(156,190,255,0.4)", frame: "#C9D6F2", emblemBg: "#0C1528", emblemFg: "#C9D6F2", emblem: "star", rarity: "common" },
  crimson: { id: "crimson", name: "Crimson royale", base: "#7A1E24", pattern: "chevron", patternColor: "rgba(255,226,196,0.28)", frame: "#F3DDBF", emblemBg: "#3F0C10", emblemFg: "#F3DDBF", emblem: "crown", rarity: "common" },
  obsidian: { id: "obsidian", name: "Obsidian", base: "#15171B", pattern: "sunburst", patternColor: "rgba(229,185,106,0.3)", frame: "#E5B96A", emblemBg: "#E5B96A", emblemFg: "#15171B", emblem: "monogram", rarity: "common" },
  emerald: { id: "emerald", name: "Emerald", base: "#0F5A3C", pattern: "lattice", patternColor: "rgba(140,230,180,0.45)", frame: "#9FE8C4", emblemBg: "#063A25", emblemFg: "#9FE8C4", emblem: "spade", rarity: "rare", unlock: "comeback_2" },
  royal: { id: "royal", name: "Royal", base: "#3D1F6E", pattern: "chevron", patternColor: "rgba(229,185,106,0.4)", frame: "#E5B96A", emblemBg: "#22103F", emblemFg: "#E5B96A", emblem: "crown", rarity: "rare", unlock: "domination_2" },
  phantom: { id: "phantom", name: "Phantom", base: "#0B0C0F", pattern: "dots", patternColor: "rgba(200,205,215,0.35)", frame: "#C9CDD4", emblemBg: "#1E2126", emblemFg: "#E8EAED", emblem: "star", rarity: "epic", unlock: "cooler_2" },
  foil: { id: "foil", name: "Gold foil", base: "#8A6E2E", pattern: "sunburst", patternColor: "rgba(255,240,200,0.55)", frame: "#FFF1C9", emblemBg: "#FFF1C9", emblemFg: "#5A3F0F", emblem: "monogram", rarity: "legendary", unlock: "bounty_3" },
};

export interface TableSkin {
  id: string;
  name: string;
  /** Felt gradient stops, centre to edge. */
  felt: [string, string, string, string];
  rail: [string, string];
  inlay: string;
  rarity: Rarity;
  unlock?: string;
}

export const TABLE_SKINS: Record<string, TableSkin> = {
  classic: { id: "classic", name: "Classic green", felt: ["#247C53", "#1F6F4A", "#155637", "#0F4029"], rail: ["#2A2F36", "#15181C"], inlay: "rgba(229,185,106,0.22)", rarity: "common" },
  midnight: { id: "midnight", name: "Midnight blue", felt: ["#2B4C7E", "#223E6A", "#182C4D", "#101E36"], rail: ["#2A2F36", "#15181C"], inlay: "rgba(201,214,242,0.22)", rarity: "common" },
  burgundy: { id: "burgundy", name: "Burgundy", felt: ["#8A2A34", "#74222B", "#54181F", "#3A1015"], rail: ["#2E2A2A", "#171313"], inlay: "rgba(243,221,191,0.22)", rarity: "common" },
  slate: { id: "slate", name: "Slate", felt: ["#4A5561", "#3E4852", "#2E353D", "#21262C"], rail: ["#2A2F36", "#15181C"], inlay: "rgba(229,185,106,0.18)", rarity: "common" },
  velvet: { id: "velvet", name: "Velvet", felt: ["#5B2C7E", "#4B2468", "#36194C", "#241033"], rail: ["#2A2F36", "#15181C"], inlay: "rgba(229,185,106,0.28)", rarity: "uncommon", unlock: "hours_50" },
  ocean: { id: "ocean", name: "Ocean", felt: ["#1D7A78", "#186563", "#114A48", "#0B3332"], rail: ["#26302F", "#121918"], inlay: "rgba(200,240,235,0.25)", rarity: "epic", unlock: "unstoppable" },
  ember: { id: "ember", name: "Ember", felt: ["#8A3B1E", "#6E2E18", "#4C1F11", "#30140B"], rail: ["#2E2521", "#171210"], inlay: "rgba(255,190,120,0.3)", rarity: "epic", unlock: "domination_3" },
  goldroom: { id: "goldroom", name: "Gold room", felt: ["#2A2418", "#211C12", "#17130C", "#0E0B07"], rail: ["#4A2E1C", "#1B100A"], inlay: "rgba(229,185,106,0.55)", rarity: "legendary", unlock: "lifer" },
};

export interface Title {
  id: string;
  text: string;
  rarity: Rarity;
  unlock: string;
}

export const TITLES: Record<string, Title> = Object.fromEntries(
  (
    [
      ["comeback_kid", "Comeback Kid", "uncommon", "comeback_1"],
      ["undead", "Undead", "legendary", "comeback_3"],
      ["dominant", "Dominant", "uncommon", "domination_1"],
      ["bounty_hunter", "Bounty Hunter", "common", "bounty_1"],
      ["executioner", "Executioner", "rare", "bounty_2"],
      ["untouchable", "Untouchable", "rare", "clean_sweep"],
      ["ran_bad", "Ran Bad", "uncommon", "cooler_1"],
      ["escape_artist", "Escape Artist", "uncommon", "houdini"],
      ["on_a_heater", "On a Heater", "rare", "heater"],
      ["ship_it", "Ship It", "common", "ship_it"],
      ["regular", "Regular", "common", "reps_10"],
      ["centurion", "Centurion", "rare", "century"],
      ["duelist", "Duelist", "uncommon", "duelist"],
      ["gunslinger", "Gunslinger", "epic", "gunslinger"],
      ["grinder", "Grinder", "common", "tier_grinder"],
      ["pro", "Pro", "uncommon", "tier_pro"],
      ["crusher", "Crusher", "rare", "tier_crusher"],
      ["shark", "Shark", "epic", "tier_shark"],
      ["the_nuts", "The Nuts", "legendary", "tier_nuts"],
    ] as [string, string, Rarity, string][]
  ).map(([id, text, rarity, unlock]) => [id, { id, text, rarity, unlock }]),
);

export interface ChipFace {
  base: string;
  stripe: string;
  inlay: string;
}

export interface ChipSkin {
  id: string;
  name: string;
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

/** Cosmetics a player owns: every default plus what their achievements unlocked. */
export function ownedCosmetics(unlocked: { kind: string; item_id: string }[]) {
  const has = new Set(unlocked.map((u) => `${u.kind}:${u.item_id}`));
  return {
    cardBacks: Object.values(CARD_BACKS).filter((c) => !c.unlock || has.has(`cardBack:${c.id}`)),
    tables: Object.values(TABLE_SKINS).filter((t) => !t.unlock || has.has(`table:${t.id}`)),
    titles: Object.values(TITLES).filter((t) => has.has(`title:${t.id}`)),
  };
}

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
