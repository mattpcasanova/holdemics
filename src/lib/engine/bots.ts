import { type Card, freshDeck } from "./cards";
import { evaluate } from "./evaluator";
import { type Action, type GameState, isInHand, legalActions, potTotal } from "./game";
import { UNITS_PER_HP } from "./modes";

export type BotLevel = "easy" | "medium" | "hard";

export const BOT_LEVELS: Record<BotLevel, { name: string; blurb: string }> = {
  easy: { name: "Rookie", blurb: "Loose and passive. Calls too much, rarely bluffs." },
  medium: { name: "Regular", blurb: "Solid fundamentals. Plays the odds." },
  hard: { name: "Shark", blurb: "Aggressive, reads ranges, shoves short stacks." },
};

interface Personality {
  sims: number;
  /** Extra equity tolerance when calling (positive = calls lighter). */
  looseness: number;
  /** Probability of raising when strong. */
  aggression: number;
  bluffFreq: number;
  /** Chance to take a random (usually passive) action. */
  mistakeRate: number;
  /** Narrow opponents' holdings when they show strength. */
  readsRanges: boolean;
  /** Stack depth (in BBs) at which the bot switches to push/fold. 0 = never. */
  pushFoldBbs: number;
}

const PERSONALITIES: Record<BotLevel, Personality> = {
  easy: { sims: 80, looseness: 0.14, aggression: 0.25, bluffFreq: 0.04, mistakeRate: 0.15, readsRanges: false, pushFoldBbs: 0 },
  medium: { sims: 180, looseness: 0.04, aggression: 0.55, bluffFreq: 0.09, mistakeRate: 0.04, readsRanges: false, pushFoldBbs: 8 },
  hard: { sims: 350, looseness: -0.01, aggression: 0.8, bluffFreq: 0.13, mistakeRate: 0, readsRanges: true, pushFoldBbs: 12 },
};

// ─── Preflop hand strength ───────────────────────────────

/** Bill Chen's formula: a quick preflop score from -1 (72o) to 20 (AA). */
export function chenScore(a: Card, b: Card): number {
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  if (hi === lo) return Math.max(5, base(hi) * 2);

  let score = base(hi);
  if (a.suit === b.suit) score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

let sortedChen: number[] | null = null;

/** Minimum Chen score of the top `fraction` of starting hands. */
function chenThreshold(fraction: number): number {
  if (!sortedChen) {
    const deck = freshDeck();
    const scores: number[] = [];
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) scores.push(chenScore(deck[i], deck[j]));
    sortedChen = scores.sort((x, y) => y - x);
  }
  const idx = Math.min(sortedChen.length - 1, Math.floor(fraction * sortedChen.length));
  return sortedChen[idx];
}

// ─── Equity ──────────────────────────────────────────────

/**
 * Monte Carlo equity of `hole` vs `opponents` unknown hands. When `rangeTop`
 * is below 1, opponents' hands are drawn (by rejection) from that top
 * fraction of starting hands.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  sims: number,
  rng: () => number,
  rangeTop = 1,
): number {
  const known = new Set([...hole, ...board].map((c) => c.rank * 4 + "shdc".indexOf(c.suit)));
  const pool = freshDeck().filter((c) => !known.has(c.rank * 4 + "shdc".indexOf(c.suit)));
  const minChen = rangeTop < 1 ? chenThreshold(rangeTop) : -Infinity;
  const boardNeeded = 5 - board.length;
  let won = 0;

  for (let s = 0; s < sims; s++) {
    let top = pool.length;
    const draw = () => {
      const j = Math.floor(rng() * top);
      top--;
      [pool[j], pool[top]] = [pool[top], pool[j]];
      return pool[top];
    };

    const oppHands: Card[][] = [];
    for (let o = 0; o < opponents; o++) {
      let hand = [draw(), draw()];
      for (let tries = 0; tries < 12 && chenScore(hand[0], hand[1]) < minChen; tries++) {
        top += 2; // put them back and try again
        hand = [draw(), draw()];
      }
      oppHands.push(hand);
    }
    const runout = [...board];
    for (let k = 0; k < boardNeeded; k++) runout.push(draw());

    const mine = evaluate([...hole, ...runout]).score;
    let best = true;
    let ties = 1;
    for (const h of oppHands) {
      const theirs = evaluate([...h, ...runout]).score;
      if (theirs > mine) {
        best = false;
        break;
      }
      if (theirs === mine) ties++;
    }
    if (best) won += 1 / ties;
  }
  return won / sims;
}

// ─── Decisions ───────────────────────────────────────────

function roundBet(units: number): number {
  const step = units >= 20 * UNITS_PER_HP ? UNITS_PER_HP : UNITS_PER_HP / 2;
  return Math.round(units / step) * step;
}

export function decideBotAction(state: GameState, level: BotLevel, rng: () => number = Math.random): Action {
  const legal = legalActions(state);
  if (!legal || state.toAct === null) throw new Error("Bot asked to act out of turn");
  const me = state.players[state.toAct];
  const persona = PERSONALITIES[level];
  const bb = state.blinds.bb;
  const pot = potTotal(state);
  const toCall = legal.callAmount;
  const preflop = state.street === "preflop";
  const opponentsInHand = state.players.filter((p, i) => i !== state.toAct && isInHand(p)).length;
  const stackBbs = (me.stack + me.bet) / bb;

  const passive = (): Action => (legal.canCheck ? { type: "check" } : { type: "call" });
  const fold = (): Action => (legal.canCheck ? { type: "check" } : { type: "fold" });
  const raiseTo = (to: number): Action => {
    if (!legal.canRaise) return passive();
    let amount = roundBet(to);
    // If the raise would commit most of the stack, just shove.
    if (amount >= legal.maxRaiseTo * 0.6) amount = legal.maxRaiseTo;
    amount = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, amount));
    return { type: "raise", to: amount };
  };

  if (rng() < persona.mistakeRate) {
    return rng() < 0.75 || !legal.canRaise ? passive() : raiseTo(legal.minRaiseTo);
  }

  // How many opponents realistically contest the pot.
  let contesting = opponentsInHand;
  if (preflop) {
    const voluntary = state.players.filter(
      (p, i) => i !== state.toAct && isInHand(p) && p.lastAction && p.lastAction.kind !== "fold",
    ).length;
    contesting = Math.min(opponentsInHand, Math.max(1, voluntary + 1));
  }

  const facingRaise = toCall > (preflop ? bb - me.bet : 0) && toCall > 0;
  const betToPot = pot > 0 ? toCall / pot : 0;
  let rangeTop = 1;
  if (persona.readsRanges && facingRaise) {
    rangeTop = betToPot > 0.9 ? 0.2 : betToPot > 0.5 ? 0.35 : 0.55;
    if (preflop) rangeTop = Math.min(rangeTop, 0.3);
  }

  const equity = estimateEquity(me.holeCards, state.board, Math.max(1, contesting), persona.sims, rng, rangeTop);
  const fairShare = 1 / (contesting + 1);
  const relative = equity / fairShare;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // Short-stack push/fold.
  if (preflop && persona.pushFoldBbs > 0 && stackBbs <= persona.pushFoldBbs) {
    const shoveRange = Math.min(0.6, 0.18 + (persona.pushFoldBbs - stackBbs) * 0.035);
    const chen = chenScore(me.holeCards[0], me.holeCards[1]);
    const unopened = !facingRaise;
    if (unopened && chen >= chenThreshold(shoveRange)) return raiseTo(legal.maxRaiseTo);
    if (!unopened && equity > potOdds + 0.02) {
      return legal.canRaise && equity > 0.5 ? raiseTo(legal.maxRaiseTo) : passive();
    }
    return fold();
  }

  if (legal.canCheck) {
    const strong = relative > 1.45 || equity > 0.72;
    if (strong && rng() < persona.aggression) {
      const sizing = preflop ? 3 * bb + me.bet : pot * (relative > 2 ? 0.75 : 0.55);
      return raiseTo(preflop ? state.currentBet + 2 * bb : sizing);
    }
    const bluffSpot = !preflop && opponentsInHand <= 2 && rng() < persona.bluffFreq;
    if (bluffSpot) return raiseTo(pot * 0.5);
    return { type: "check" };
  }

  // Facing a bet.
  if (preflop && !facingRaise) {
    // Unopened pot (only blinds): open-raise good hands, limp/fold the rest.
    const chen = chenScore(me.holeCards[0], me.holeCards[1]);
    const openRange = level === "easy" ? 0.55 : level === "medium" ? 0.3 : 0.26;
    if (chen >= chenThreshold(openRange * 0.6) && rng() < persona.aggression + 0.2) {
      return raiseTo(state.currentBet + 1.5 * bb + bb * contesting * 0.5);
    }
    if (chen >= chenThreshold(openRange)) return passive();
    return fold();
  }

  if (equity + persona.looseness < potOdds) {
    const bluffRaise = !preflop && legal.canRaise && rng() < persona.bluffFreq * 0.4;
    return bluffRaise ? raiseTo(state.currentBet * 2.5) : fold();
  }

  if ((relative > 1.8 || equity > 0.75) && legal.canRaise && rng() < persona.aggression) {
    const to = state.currentBet + (pot + toCall) * (equity > 0.85 ? 1 : 0.7);
    return raiseTo(to);
  }
  return passive();
}
