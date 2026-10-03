import { type Card, createRng, freshDeck } from "./engine/cards";
import { evaluate } from "./engine/evaluator";
import type { GameState } from "./engine/game";

/**
 * Facts about one finished hand, for achievements. Reads the hand's log plus
 * every player's hole cards, so it only runs where the full state lives (the
 * table server), never on a redacted client view.
 */

export interface HandFacts {
  /** Won a pot holding 7-2. */
  won72: boolean;
  /** ...and it went to showdown. */
  won72Showdown: boolean;
  /**
   * Won uncontested with a post-flop bet or raise while a folder had you beat:
   * your equity against the strongest folder was BLUFF_MAX_EQUITY or less.
   */
  bluff: { equity: number; pot: number; beforeRiver: boolean; allIn: boolean } | null;
  /** Won chips at a showdown where someone (them or an opponent) was all in. */
  allInWin: boolean;
  /** Equity when the money went in with cards still to come, and whether they won. */
  allIn: { equity: number; won: boolean } | null;
}

const PREFLOP_SIMS = 6000;
/** A bet only counts as a bluff when you'd win this often or less if called. */
export const BLUFF_MAX_EQUITY = 0.3;
const cardId = (c: Card) => c.rank * 4 + "shdc".indexOf(c.suit);

/**
 * Each hand's share of the pot over all runouts of `board`. Exact when at most
 * two cards are to come; sampled (seeded, so repeatable) from preflop.
 */
export function equities(holes: Card[][], board: Card[], seed = 1): number[] {
  const known = new Set([...holes.flat(), ...board].map(cardId));
  const pool = freshDeck().filter((c) => !known.has(cardId(c)));
  const need = 5 - board.length;
  const shares = holes.map(() => 0);
  let runs = 0;

  const score = (runout: Card[]) => {
    const scores = holes.map((h) => evaluate([...h, ...runout]).score);
    const best = Math.max(...scores);
    const winners = scores.filter((s) => s === best).length;
    scores.forEach((s, i) => {
      if (s === best) shares[i] += 1 / winners;
    });
    runs++;
  };

  if (need === 0) score(board);
  else if (need === 1) for (const a of pool) score([...board, a]);
  else if (need === 2) for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) score([...board, pool[i], pool[j]]);
  else {
    const rng = createRng(seed);
    for (let s = 0; s < PREFLOP_SIMS; s++) {
      const deck = pool.slice();
      const runout = [...board];
      for (let k = 0; k < need; k++) {
        const j = Math.floor(rng() * deck.length);
        runout.push(deck[j]);
        deck[j] = deck[deck.length - 1];
        deck.pop();
      }
      score(runout);
    }
  }
  return shares.map((s) => s / runs);
}

const is72 = (cards: Card[]) => cards.length === 2 && cards.some((c) => c.rank === 7) && cards.some((c) => c.rank === 2);

/** Facts for every player dealt into the finished hand `g` (which must have a result). */
export function analyzeHand(g: GameState): Record<number, HandFacts> {
  const r = g.result;
  const out: Record<number, HandFacts> = {};
  if (!r) return out;
  g.players.forEach((p, i) => {
    if (!p.dealt) return;
    const won = (r.payouts[i] ?? 0) > 0;
    out[i] = { won72: won && is72(p.holeCards), won72Showdown: won && r.showdown && is72(p.holeCards), bluff: null, allIn: null, allInWin: false };
  });

  // Replay the log, noting the board at each event.
  const events = g.log.map((e, idx) => ({ e, idx }));
  const boardAt: Card[][] = [];
  let board: Card[] = [];
  for (const { e } of events) {
    if (e.kind === "street") board = [...board, ...e.cards];
    boardAt.push(board);
  }
  const actions = events.filter(({ e }) => e.kind === "action");
  const seed = g.seed * 1000 + g.handNumber;

  if (!r.showdown) {
    // Uncontested: the winner's last bet or raise was the hand's last, and everyone after folded.
    const winner = Object.keys(r.payouts).map(Number).find((i) => (r.payouts[i] ?? 0) > 0);
    const aggressive = actions.filter(({ e }) => e.kind === "action" && (e.action === "bet" || e.action === "raise"));
    const last = aggressive[aggressive.length - 1];
    if (winner !== undefined && out[winner] && last && last.e.kind === "action" && last.e.player === winner) {
      const atBet = boardAt[last.idx];
      if (atBet.length >= 3) {
        const folders = actions.filter(({ e, idx }) => idx > last.idx && e.kind === "action" && e.action === "fold").map(({ e }) => (e.kind === "action" ? e.player : -1));
        if (folders.length) {
          const equity = Math.min(...folders.map((f) => equities([g.players[winner].holeCards, g.players[f].holeCards], atBet, seed)[0]));
          const pot = r.pots.reduce((sum, p) => sum + p.amount, 0);
          if (equity <= BLUFF_MAX_EQUITY) out[winner].bluff = { equity, pot, beforeRiver: atBet.length < 5, allIn: last.e.allIn };
        }
      }
    }
    return out;
  }

  const live0 = Object.keys(r.hands).map(Number);
  if (live0.some((i) => g.players[i].allIn)) for (const i of live0) if (out[i] && (r.payouts[i] ?? 0) > 0) out[i].allInWin = true;

  // Showdown with cards still to come after the last decision means the money was all in.
  const lastAction = actions[actions.length - 1];
  const atAllIn = lastAction ? boardAt[lastAction.idx] : [];
  const live = Object.keys(r.hands).map(Number);
  if (lastAction && atAllIn.length < 5 && live.length >= 2) {
    const eq = equities(live.map((i) => g.players[i].holeCards), atAllIn, seed);
    live.forEach((i, k) => {
      if (out[i]) out[i].allIn = { equity: eq[k], won: (r.payouts[i] ?? 0) > 0 };
    });
  }
  return out;
}
