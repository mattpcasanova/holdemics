import type { BotLevel } from "../engine/bots";
import type { Action, GameState, LegalActions, LogEvent } from "../engine/game";
import type { ModeId } from "../engine/modes";

/**
 * Messages between a table's browser clients and its Durable Object. The
 * server never sends another player's hole cards before showdown; the view
 * it sends is produced by `redactView` in ./view.ts.
 */

export interface RankedPlayer {
  userId: string;
  name: string;
  title?: string | null;
  rating: number;
  games: number;
}

export interface TableConfig {
  code: string;
  mode: ModeId;
  hostId: string;
  /** Difficulty of any bots the host adds when starting. */
  botLevel: BotLevel;
  /** Number of seats at the table (2–9). Ranked tables use the mode's seat count. */
  seats: number;
  createdAt: number;
  /** Ranked tables are created by the matchmaker with fixed players and no bots. */
  ranked?: boolean;
  players?: RankedPlayer[];
}

export interface SeatView {
  index: number;
  userId: string | null;
  name: string;
  /** Selected profile title id, shown under the name. */
  title: string | null;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
  sittingOut: boolean;
}

export type TablePhase = "lobby" | "playing" | "finished";

/** The decision currently on the clock. */
export interface TurnView {
  player: number;
  startedAt: number;
  decisionMs: number;
  /** The viewer's own remaining time bank; 0 for everyone else. */
  bankMs: number;
}

/** An all-in runout being revealed street by street. */
export interface RunoutView {
  hand: number;
  from: number;
  startedAt: number;
}

export interface TableView {
  config: TableConfig;
  phase: TablePhase;
  seats: SeatView[];
  /** Redacted engine state; null in the lobby before the first deal. */
  game: GameState | null;
  /** Index of the viewer in `game.players`, or null when spectating. */
  you: number | null;
  legal: LegalActions | null;
  turn: TurnView | null;
  runout: RunoutView | null;
  /** Hands played so far, most recent last (capped). */
  history: { hand: number; events: LogEvent[] }[];
  /** Server transition counter; echoed back with actions so stale ones are ignored. */
  step: number;
  /** Ranked only, once the game has ended and ratings are written; keyed by user id. */
  ratingChanges?: Record<string, { before: number; after: number }>;
  /** Set when a ranked match was called off before it started. */
  cancelled?: string;
  /** Achievements newly earned in this game, keyed by user id. */
  achievements?: Record<string, string[]>;
}

export type ClientMessage =
  | { type: "sit" }
  | { type: "stand" }
  /** Host starts the game, adding `bots` bots to the empty seats (0 = none). */
  | { type: "start"; bots?: number }
  | { type: "act"; action: Action; hand: number; step: number }
  | { type: "back" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "view"; view: TableView }
  | { type: "error"; message: string }
  | { type: "pong" };

/** Server-to-server call from the Next route handler that creates a table. */
export interface CreateTableRequest {
  config: TableConfig;
}

export type QueueClientMessage = { type: "leave" } | { type: "ping" };

export type QueueServerMessage =
  | { type: "queued"; waiting: number; since: number; window: number }
  | { type: "matched"; code: string }
  | { type: "pong" };
