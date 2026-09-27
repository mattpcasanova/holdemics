import type { GameState } from "../engine/game";

/**
 * All-in runout presentation. The engine deals every remaining street at once;
 * the table then shows the board face down and flips it street by street,
 * holding back the result until the river is up.
 */

const FIRST_FLIP = 800;
const TURN_GAP = 1500;
const RIVER_GAP = 1900;
const RESULT_AFTER = 900;

/** When each board card (index 0–4) flips, in ms from the start of the runout. */
export function runoutSchedule(from: number): { flipAt: Record<number, number>; doneAt: number } {
  const flipAt: Record<number, number> = {};
  let t = FIRST_FLIP;
  if (from === 0) {
    flipAt[0] = t;
    flipAt[1] = t + 120;
    flipAt[2] = t + 240;
    t += TURN_GAP;
  }
  if (from <= 3) {
    flipAt[3] = t;
    t += RIVER_GAP;
  }
  flipAt[4] = t;
  return { flipAt, doneAt: t + RESULT_AFTER };
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
