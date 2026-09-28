/**
 * Chip amounts are integers in "units": 1 HP = 10 units. This lets the
 * opening small blind be 0.5 HP while keeping all math integral.
 */
export const UNITS_PER_HP = 10;
/** Most seats at any table (custom tables pick 2–9; ranked modes fix their own). */
export const MAX_SEATS = 9;
export const STARTING_HP = 100;
export const STARTING_STACK = STARTING_HP * UNITS_PER_HP;

export type ModeId = "standard" | "turbo" | "headsup";

export interface ModeConfig {
  id: ModeId;
  name: string;
  tagline: string;
  seats: number;
  /**
   * How long each blind level lasts. Orbit-based levels last one trip of the
   * button around the players still alive, so levels get shorter as the table
   * shrinks.
   */
  levelLength: { kind: "orbits"; orbits: number } | { kind: "hands"; hands: number };
  /** Seconds per decision in live play. */
  decisionSeconds: number;
  /** Extra seconds per game, drawn down automatically once a decision clock expires. */
  timeBankSeconds: number;
  estimatedMinutes: string;
}

/** Big blind per level, in HP. Small blind is always half. */
export const BLIND_LEVELS_HP = [1, 2, 3, 5, 8, 12, 18, 25, 35, 50, 70, 100, 150, 200, 300, 400];

export const MODES: Record<ModeId, ModeConfig> = {
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "8 players. Classic pace.",
    seats: 8,
    levelLength: { kind: "orbits", orbits: 1 },
    decisionSeconds: 20,
    timeBankSeconds: 30,
    estimatedMinutes: "~25 min",
  },
  turbo: {
    id: "turbo",
    name: "Turbo",
    tagline: "8 players. Blinds climb fast.",
    seats: 8,
    levelLength: { kind: "orbits", orbits: 0.5 },
    decisionSeconds: 12,
    timeBankSeconds: 20,
    estimatedMinutes: "~15 min",
  },
  headsup: {
    id: "headsup",
    name: "Heads-Up",
    tagline: "1v1. Winner takes all.",
    seats: 2,
    levelLength: { kind: "orbits", orbits: 2 },
    decisionSeconds: 15,
    timeBankSeconds: 25,
    estimatedMinutes: "~10 min",
  },
};

export interface Blinds {
  sb: number;
  bb: number;
}

export function blindsForLevel(level: number): Blinds {
  const idx = Math.min(level, BLIND_LEVELS_HP.length - 1);
  const bb = BLIND_LEVELS_HP[idx] * UNITS_PER_HP;
  return { sb: bb / 2, bb };
}

/** Hands in a new level, given how many players are still alive. */
export function levelHands(mode: ModeConfig, alive: number): number {
  if (mode.levelLength.kind === "hands") return mode.levelLength.hands;
  return Math.max(2, Math.round(alive * mode.levelLength.orbits));
}

export function describeLevelLength(mode: ModeConfig): string {
  const l = mode.levelLength;
  if (l.kind === "hands") return `every ${l.hands} hands`;
  if (l.orbits === 1) return "every orbit";
  return `every ${l.orbits} orbits`;
}

/** Format units as an HP string: 1000 -> "100", 15 -> "1.5". */
export function formatHp(units: number): string {
  const hp = units / UNITS_PER_HP;
  return Number.isInteger(hp) ? String(hp) : hp.toFixed(1);
}
