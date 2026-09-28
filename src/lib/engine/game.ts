import { type Card, createRng, freshDeck, shuffle } from "./cards";
import { type HandValue, describeHand, evaluate } from "./evaluator";
import {
  type Blinds,
  type ModeId,
  MODES,
  STARTING_STACK,
  blindsForLevel,
  levelHands,
} from "./modes";

export type Street = "preflop" | "flop" | "turn" | "river";

export type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** Bet or raise to a total street commitment of `to`. */
  | { type: "raise"; to: number };

export type ActionKind = "fold" | "check" | "call" | "bet" | "raise";

export interface SeatInfo {
  id: string;
  name: string;
  isBot: boolean;
}

export interface PlayerState extends SeatInfo {
  stack: number;
  eliminated: boolean;
  /** Final placement (1 = winner), set once eliminated or the game ends. */
  place: number | null;
  holeCards: Card[];
  /** Dealt into the current hand. Kept separate from holeCards so views can hide cards. */
  dealt: boolean;
  folded: boolean;
  allIn: boolean;
  /** Committed on the current street. */
  bet: number;
  /** Committed over the whole hand. */
  totalBet: number;
  needsToAct: boolean;
  /** False once the player has acted, until a full raise reopens the action. */
  canRaise: boolean;
  lastAction: { kind: ActionKind; amount: number; allIn: boolean } | null;
  startStack: number;
}

export interface PotResult {
  amount: number;
  winners: number[];
}

export interface HandResult {
  showdown: boolean;
  pots: PotResult[];
  /** Net chips pushed to each winner, by player index. */
  payouts: Record<number, number>;
  /** Evaluated hands for players who reached showdown. */
  hands: Record<number, { value: HandValue; name: string }>;
  busted: number[];
}

export type LogEvent =
  | { kind: "hand"; hand: number; level: number; blinds: Blinds }
  | { kind: "level"; level: number; blinds: Blinds }
  | { kind: "post"; player: number; amount: number; blind: "SB" | "BB" }
  | { kind: "action"; player: number; action: ActionKind; amount: number; allIn: boolean }
  | { kind: "street"; street: Street; cards: Card[] }
  | { kind: "return"; player: number; amount: number }
  | { kind: "show"; player: number; hand: string }
  | { kind: "win"; player: number; amount: number; hand: string | null }
  | { kind: "bust"; player: number; place: number };

export type Phase = "waiting" | "betting" | "complete" | "finished";

export interface GameState {
  mode: ModeId;
  seed: number;
  players: PlayerState[];
  button: number;
  sbIndex: number;
  bbIndex: number;
  /** 1-based; 0 before the first hand. */
  handNumber: number;
  level: number;
  /** Hands left in the current level, including the hand in progress. */
  handsLeftInLevel: number;
  blinds: Blinds;
  deck: Card[];
  board: Card[];
  street: Street;
  phase: Phase;
  toAct: number | null;
  currentBet: number;
  minRaise: number;
  result: HandResult | null;
  /** Events for the current hand only; callers accumulate history if needed. */
  log: LogEvent[];
}

export interface LegalActions {
  canCheck: boolean;
  /** Chips needed to call (0 if checking is possible). Capped at stack. */
  callAmount: number;
  canRaise: boolean;
  /** Minimum legal raise-to (or all-in if the stack is short). */
  minRaiseTo: number;
  maxRaiseTo: number;
  /** True when no bet has been made this street, so a raise is a "bet". */
  isBet: boolean;
}

// ─── Setup ───────────────────────────────────────────────

export function createGame(opts: { mode: ModeId; seats: SeatInfo[]; seed: number }): GameState {
  const mode = MODES[opts.mode];
  if (opts.seats.length < 2 || opts.seats.length > mode.seats) {
    throw new Error(`${mode.name} needs 2–${mode.seats} players`);
  }
  const rng = createRng(opts.seed);
  const players: PlayerState[] = opts.seats.map((s) => ({
    ...s,
    stack: STARTING_STACK,
    eliminated: false,
    place: null,
    holeCards: [],
    dealt: false,
    folded: false,
    allIn: false,
    bet: 0,
    totalBet: 0,
    needsToAct: false,
    canRaise: false,
    lastAction: null,
    startStack: STARTING_STACK,
  }));

  return {
    mode: opts.mode,
    seed: opts.seed,
    players,
    // startHand advances the button, so start one seat "before" a random seat.
    button: Math.floor(rng() * players.length) - 1,
    sbIndex: -1,
    bbIndex: -1,
    handNumber: 0,
    level: 0,
    handsLeftInLevel: 0,
    blinds: blindsForLevel(0),
    deck: [],
    board: [],
    street: "preflop",
    phase: "waiting",
    toAct: null,
    currentBet: 0,
    minRaise: 0,
    result: null,
    log: [],
  };
}

// ─── Queries ─────────────────────────────────────────────

export function isInHand(p: PlayerState): boolean {
  return !p.eliminated && !p.folded && p.dealt;
}

function canAct(p: PlayerState): boolean {
  return isInHand(p) && !p.allIn;
}

function nextIndex(state: GameState, from: number, pred: (p: PlayerState) => boolean): number | null {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + step) % n) + n) % n;
    if (pred(state.players[i])) return i;
  }
  return null;
}

export function alivePlayers(state: GameState): number[] {
  return state.players.flatMap((p, i) => (p.eliminated ? [] : [i]));
}

export function potTotal(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.totalBet, 0);
}

export function legalActions(state: GameState): LegalActions | null {
  if (state.phase !== "betting" || state.toAct === null) return null;
  const p = state.players[state.toAct];
  const toCall = Math.max(0, state.currentBet - p.bet);
  const maxRaiseTo = p.bet + p.stack;
  const othersCanRespond = state.players.some((o, i) => i !== state.toAct && canAct(o));
  const canRaise = p.canRaise && maxRaiseTo > state.currentBet && othersCanRespond;
  return {
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    canRaise,
    minRaiseTo: Math.min(state.currentBet + state.minRaise, maxRaiseTo),
    maxRaiseTo,
    isBet: state.currentBet === 0,
  };
}

/** Position labels keyed by player index, for players dealt into the current hand. */
export function positionLabels(state: GameState): Record<number, string> {
  const labels: Record<number, string> = {};
  const alive = alivePlayers(state);
  if (state.button < 0 || alive.length === 0) return labels;

  const order: number[] = [];
  let i: number | null = state.button;
  if (state.players[i]?.eliminated) i = nextIndex(state, i, (p) => !p.eliminated);
  while (i !== null && order.length < alive.length) {
    order.push(i);
    i = nextIndex(state, i, (p) => !p.eliminated);
  }

  if (order.length === 2) {
    labels[order[0]] = "BTN";
    labels[order[1]] = "BB";
    return labels;
  }
  const middle = ["UTG", "UTG+1", "MP", "HJ", "CO"].slice(5 - (order.length - 3));
  order.forEach((idx, k) => {
    if (k === 0) labels[idx] = "BTN";
    else if (k === 1) labels[idx] = "SB";
    else if (k === 2) labels[idx] = "BB";
    else labels[idx] = middle[k - 3];
  });
  return labels;
}

// ─── Hand flow ───────────────────────────────────────────

function commit(p: PlayerState, amount: number): number {
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.bet += paid;
  p.totalBet += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

export function startHand(prev: GameState): GameState {
  if (prev.phase === "finished") throw new Error("Game is over");
  if (prev.phase === "betting") throw new Error("Hand already in progress");
  const state = structuredClone(prev);
  const mode = MODES[state.mode];

  state.handNumber += 1;
  const aliveCount = alivePlayers(state).length;
  let leveledUp = false;
  if (state.handNumber === 1) {
    state.handsLeftInLevel = levelHands(mode, aliveCount);
  } else if (--state.handsLeftInLevel <= 0) {
    state.level += 1;
    state.handsLeftInLevel = levelHands(mode, aliveCount);
    leveledUp = true;
  }
  const level = state.level;
  state.blinds = blindsForLevel(level);
  state.log = [{ kind: "hand", hand: state.handNumber, level, blinds: state.blinds }];
  if (leveledUp) state.log.push({ kind: "level", level, blinds: state.blinds });

  for (const p of state.players) {
    p.holeCards = [];
    p.dealt = false;
    p.folded = false;
    p.allIn = false;
    p.bet = 0;
    p.totalBet = 0;
    p.needsToAct = false;
    p.canRaise = false;
    p.lastAction = null;
    p.startStack = p.stack;
  }
  state.board = [];
  state.street = "preflop";
  state.result = null;

  const alive = (p: PlayerState) => !p.eliminated;
  state.button = nextIndex(state, state.button, alive)!;
  const headsUp = alivePlayers(state).length === 2;
  state.sbIndex = headsUp ? state.button : nextIndex(state, state.button, alive)!;
  state.bbIndex = nextIndex(state, state.sbIndex, alive)!;

  const rng = createRng((state.seed ^ Math.imul(state.handNumber, 0x9e3779b1)) >>> 0);
  state.deck = shuffle(freshDeck(), rng);

  // Deal two cards each, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let i = state.sbIndex;
    for (let k = 0; k < alivePlayers(state).length; k++) {
      state.players[i].holeCards.push(state.deck.pop()!);
      state.players[i].dealt = true;
      i = nextIndex(state, i, alive)!;
    }
  }

  const sb = state.players[state.sbIndex];
  const bb = state.players[state.bbIndex];
  state.log.push({ kind: "post", player: state.sbIndex, amount: commit(sb, state.blinds.sb), blind: "SB" });
  state.log.push({ kind: "post", player: state.bbIndex, amount: commit(bb, state.blinds.bb), blind: "BB" });

  state.currentBet = state.blinds.bb;
  state.minRaise = state.blinds.bb;
  state.phase = "betting";
  for (const p of state.players) {
    if (canAct(p)) {
      p.needsToAct = true;
      p.canRaise = true;
    }
  }
  // A player who has already matched the bet with no one left to act against doesn't need to act.
  settleNeedsToAct(state);

  state.toAct = nextIndex(state, state.bbIndex, (p) => canAct(p) && p.needsToAct);
  if (state.toAct === null) endStreet(state);
  return state;
}

/** If at most one player can still act and they've matched the bet, the street is closed. */
function settleNeedsToAct(state: GameState) {
  const actors = state.players.filter(canAct);
  if (actors.length === 1 && actors[0].bet >= state.currentBet) actors[0].needsToAct = false;
}

export function applyAction(prev: GameState, action: Action): GameState {
  const legal = legalActions(prev);
  if (!legal || prev.toAct === null) throw new Error("No action expected");
  const state = structuredClone(prev);
  const idx = state.toAct!;
  const p = state.players[idx];

  switch (action.type) {
    case "fold": {
      p.folded = true;
      p.lastAction = { kind: "fold", amount: 0, allIn: false };
      state.log.push({ kind: "action", player: idx, action: "fold", amount: 0, allIn: false });
      break;
    }
    case "check":
    case "call": {
      if (legal.canCheck) {
        p.lastAction = { kind: "check", amount: 0, allIn: false };
        state.log.push({ kind: "action", player: idx, action: "check", amount: 0, allIn: false });
      } else {
        const paid = commit(p, legal.callAmount);
        p.lastAction = { kind: "call", amount: p.bet, allIn: p.allIn };
        state.log.push({ kind: "action", player: idx, action: "call", amount: paid, allIn: p.allIn });
      }
      break;
    }
    case "raise": {
      if (!legal.canRaise) throw new Error("Raising is not allowed");
      const to = Math.round(action.to);
      if (to > legal.maxRaiseTo) throw new Error("Raise exceeds stack");
      if (to < legal.minRaiseTo) throw new Error("Raise below minimum");
      const raiseSize = to - state.currentBet;
      const isFullRaise = raiseSize >= state.minRaise;
      commit(p, to - p.bet);
      const kind: ActionKind = legal.isBet ? "bet" : "raise";
      p.lastAction = { kind, amount: to, allIn: p.allIn };
      state.log.push({ kind: "action", player: idx, action: kind, amount: to, allIn: p.allIn });

      state.currentBet = to;
      if (isFullRaise) state.minRaise = raiseSize;
      for (const [i, o] of state.players.entries()) {
        if (i === idx || !canAct(o)) continue;
        o.needsToAct = true;
        if (isFullRaise) o.canRaise = true;
      }
      break;
    }
  }

  p.needsToAct = false;
  p.canRaise = false;

  const remaining = state.players.filter(isInHand);
  if (remaining.length === 1) {
    awardUncontested(state);
    return state;
  }

  settleNeedsToAct(state);
  state.toAct = nextIndex(state, idx, (o) => canAct(o) && o.needsToAct);
  if (state.toAct === null) endStreet(state);
  return state;
}

function returnUncalled(state: GameState) {
  const bets = state.players.map((p) => p.bet);
  const max = Math.max(...bets);
  const top = bets.filter((b) => b === max).length;
  if (max === 0 || top > 1) return;
  const second = Math.max(0, ...bets.filter((b) => b !== max));
  const idx = bets.indexOf(max);
  const refund = max - second;
  const p = state.players[idx];
  p.stack += refund;
  p.bet -= refund;
  p.totalBet -= refund;
  if (p.stack > 0) p.allIn = false;
  state.log.push({ kind: "return", player: idx, amount: refund });
}

function dealStreet(state: GameState, street: Street) {
  const count = street === "flop" ? 3 : 1;
  const cards = state.deck.splice(-count, count).reverse();
  state.board.push(...cards);
  state.street = street;
  state.log.push({ kind: "street", street, cards });
}

const NEXT_STREET: Record<Street, Street | null> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: null,
};

function endStreet(state: GameState) {
  returnUncalled(state);
  for (const p of state.players) {
    p.bet = 0;
    p.needsToAct = false;
  }
  state.currentBet = 0;
  state.minRaise = state.blinds.bb;
  state.toAct = null;

  const actors = state.players.filter(canAct);
  let next = NEXT_STREET[state.street];

  if (next && actors.length <= 1) {
    // Everyone else is all-in: run it out.
    while (next) {
      dealStreet(state, next);
      next = NEXT_STREET[next];
    }
    showdown(state);
    return;
  }
  if (!next) {
    showdown(state);
    return;
  }

  dealStreet(state, next);
  for (const p of state.players) {
    p.lastAction = null;
    if (canAct(p)) {
      p.needsToAct = true;
      p.canRaise = true;
    }
  }
  state.toAct = nextIndex(state, state.button, (p) => canAct(p) && p.needsToAct);
}

/** Split the pot into main/side pots from each player's total commitment. */
export function buildPots(players: PlayerState[]): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(players.map((p) => p.totalBet).filter((b) => b > 0))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: number[] }[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.totalBet, level) - prevLevel);
    const eligible = players.flatMap((p, i) => (isInHand(p) && p.totalBet >= level ? [i] : []));
    if (eligible.length === 0 && pots.length) pots[pots.length - 1].amount += amount;
    else if (eligible.length === 0) pots.push({ amount, eligible: players.flatMap((p, i) => (isInHand(p) ? [i] : [])) });
    else if (pots.length && sameMembers(pots[pots.length - 1].eligible, eligible)) pots[pots.length - 1].amount += amount;
    else pots.push({ amount, eligible });
    prevLevel = level;
  }
  return pots;
}

function sameMembers(a: number[], b: number[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Order indices clockwise starting left of the button (used for odd-chip distribution). */
function fromButton(state: GameState, indices: number[]): number[] {
  const n = state.players.length;
  return [...indices].sort(
    (a, b) => ((a - state.button - 1 + n) % n) - ((b - state.button - 1 + n) % n),
  );
}

function showdown(state: GameState) {
  const contenders = state.players.flatMap((p, i) => (isInHand(p) ? [i] : []));
  const hands: HandResult["hands"] = {};
  for (const i of contenders) {
    const value = evaluate([...state.players[i].holeCards, ...state.board]);
    hands[i] = { value, name: describeHand(value) };
    state.log.push({ kind: "show", player: i, hand: hands[i].name });
  }

  const payouts: Record<number, number> = {};
  const pots: PotResult[] = [];
  for (const pot of buildPots(state.players)) {
    const best = Math.max(...pot.eligible.map((i) => hands[i].value.score));
    const winners = fromButton(state, pot.eligible.filter((i) => hands[i].value.score === best));
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    for (const w of winners) {
      const won = share + (remainder-- > 0 ? 1 : 0);
      payouts[w] = (payouts[w] ?? 0) + won;
    }
    pots.push({ amount: pot.amount, winners });
  }

  for (const [i, amount] of Object.entries(payouts)) {
    const idx = Number(i);
    state.players[idx].stack += amount;
    state.log.push({ kind: "win", player: idx, amount, hand: hands[idx].name });
  }
  finishHand(state, { showdown: true, pots, payouts, hands, busted: [] });
}

function awardUncontested(state: GameState) {
  returnUncalled(state);
  const winner = state.players.findIndex(isInHand);
  const amount = potTotal(state);
  state.players[winner].stack += amount;
  state.log.push({ kind: "win", player: winner, amount, hand: null });
  finishHand(state, {
    showdown: false,
    pots: [{ amount, winners: [winner] }],
    payouts: { [winner]: amount },
    hands: {},
    busted: [],
  });
}

function finishHand(state: GameState, result: HandResult) {
  state.toAct = null;
  for (const p of state.players) {
    p.bet = 0;
    p.totalBet = 0;
  }
  const busted = state.players
    .flatMap((p, i) => (!p.eliminated && p.stack === 0 ? [i] : []))
    // Bigger stack at the start of the hand finishes higher.
    .sort((a, b) => state.players[b].startStack - state.players[a].startStack);

  const survivors = alivePlayers(state).length - busted.length;
  busted.forEach((i, k) => {
    const p = state.players[i];
    p.eliminated = true;
    p.place = survivors + k + 1;
    state.log.push({ kind: "bust", player: i, place: p.place });
  });
  result.busted = busted;
  state.result = result;

  if (survivors <= 1) {
    const winner = state.players.findIndex((p) => !p.eliminated);
    if (winner >= 0) state.players[winner].place = 1;
    state.phase = "finished";
  } else {
    state.phase = "complete";
  }
}

/** Player indices ordered by current standing: alive by stack, then eliminated by place. */
export function standings(state: GameState): number[] {
  return state.players
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = state.players[a];
      const pb = state.players[b];
      if (pa.place !== null && pb.place !== null) return pa.place - pb.place;
      if (pa.place !== null) return pa.place === 1 ? -1 : 1;
      if (pb.place !== null) return pb.place === 1 ? 1 : -1;
      return pb.stack + pb.totalBet - (pa.stack + pa.totalBet);
    });
}
