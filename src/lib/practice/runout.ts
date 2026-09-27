import type { GameState } from "../engine/game";

/**
 * All-in runout presentation. The engine deals every remaining street at once;
 * the table deals each street face down only when it is reached, turns it
 * over, pauses, and moves on. The river gets a longer, slower reveal.
 */

export interface CardTiming {
  /** ms from the start of the runout when the card lands face down. */
  dealAt: number;
  /** ms from the start when it starts turning over. */
  flipAt: number;
  /** Slow, lifted reveal (the river). */
  dramatic: boolean;
}

const DEAL_STAGGER = 90;
const FLOP_FLIP_STAGGER = 130;
/** How long a face-down street sits before it turns. */
const HOLD = { flop: 700, turn: 700, river: 1500 };
/** Pause after a street is face up before the next one is dealt. */
const BETWEEN = 1100;
const RESULT_AFTER = 1000;
const START = 500;
export const DRAMATIC_FLIP_MS = 900;

export function runoutSchedule(from: number): { cards: Record<number, CardTiming>; doneAt: number } {
  const cards: Record<number, CardTiming> = {};
  let t = START;
  if (from === 0) {
    for (let i = 0; i < 3; i++) {
      cards[i] = { dealAt: t + i * DEAL_STAGGER, flipAt: t + HOLD.flop + i * FLOP_FLIP_STAGGER, dramatic: false };
    }
    t += HOLD.flop + 2 * FLOP_FLIP_STAGGER + BETWEEN;
  }
  if (from <= 3) {
    cards[3] = { dealAt: t, flipAt: t + HOLD.turn, dramatic: false };
    t += HOLD.turn + BETWEEN;
  }
  cards[4] = { dealAt: t, flipAt: t + HOLD.river, dramatic: true };
  t += HOLD.river + DRAMATIC_FLIP_MS;
  return { cards, doneAt: t + RESULT_AFTER };
}

/**
 * A copy of a finished hand with the outcome hidden: winnings not yet paid,
 * busted players still seated, winners unknown. Hole cards stay revealed.
 */
export function maskResult(game: GameState): GameState {
  if (!game.result) return game;
  const g = structuredClone(game);
  const result = g.result!;
  for (const [i, amount] of Object.entries(result.payouts)) g.players[Number(i)].stack -= amount;
  for (const i of result.busted) {
    g.players[i].eliminated = false;
    g.players[i].place = null;
  }
  if (g.phase === "finished") {
    g.phase = "complete";
    for (const p of g.players) if (p.place === 1) p.place = null;
  }
  g.result = { ...result, payouts: {}, pots: result.pots.map((p) => ({ ...p, winners: [] })) };
  g.log = g.log.filter((e) => e.kind !== "win" && e.kind !== "bust" && e.kind !== "show" && e.kind !== "street");
  return g;
}
