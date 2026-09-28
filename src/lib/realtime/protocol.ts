import type { BotLevel } from "../engine/bots";
import type { Action, GameState, LegalActions, LogEvent } from "../engine/game";
import type { ModeId } from "../engine/modes";

/**
 * Messages between a table's browser clients and its Durable Object. The
 * server never sends another player's hole cards before showdown; the view
 * it sends is produced by `redactView` in ./view.ts.
 */

export interface TableConfig {
  code: string;
  mode: ModeId;
  hostId: string;
  /** Bots used to fill empty seats when the host starts the game. */
  botLevel: BotLevel;
  createdAt: number;
}

export interface SeatView {
  index: number;
  userId: string | null;
  name: string;
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
}

export type ClientMessage =
  | { type: "sit" }
  | { type: "stand" }
  | { type: "start" }
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
