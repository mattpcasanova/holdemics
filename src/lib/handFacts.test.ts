import { describe, expect, it } from "vitest";
import { parseCards } from "./engine/cards";
import { evaluate } from "./engine/evaluator";
import type { GameState, HandResult, LogEvent, PlayerState } from "./engine/game";
import { analyzeHand, equities } from "./handFacts";

function player(cards: string, over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: cards, name: cards, isBot: false, stack: 0, eliminated: false, place: null, holeCards: parseCards(cards), dealt: true,
    folded: false, allIn: false, bet: 0, totalBet: 0, needsToAct: false, canRaise: false, lastAction: null, startStack: 1000, ...over,
  };
}

function hand(players: PlayerState[], log: LogEvent[], result: Partial<HandResult>): GameState {
  return {
    mode: "standard", seed: 7, players, button: 0, sbIndex: 0, bbIndex: 1, handNumber: 3, level: 0, handsLeftInLevel: 1,
    blinds: { sb: 5, bb: 10 }, deck: [], board: [], street: "river", phase: "complete", toAct: null, currentBet: 0, minRaise: 10, log,
    result: { showdown: false, pots: [], payouts: {}, hands: {}, busted: [], ...result },
  };
}

const act = (player: number, action: "fold" | "check" | "call" | "bet" | "raise", amount = 0): LogEvent => ({ kind: "action", player, action, amount, allIn: false });
const street = (s: "flop" | "turn" | "river", cards: string): LogEvent => ({ kind: "street", street: s, cards: parseCards(cards) });
const shown = (cards: string, board: string) => ({ value: evaluate(parseCards(`${cards} ${board}`)), name: "" });

describe("equities", () => {
  it("matches known matchups", () => {
    const [aa, kk] = equities([parseCards("As Ah"), parseCards("Ks Kh")], []);
    expect(aa).toBeGreaterThan(0.78);
    expect(aa).toBeLessThan(0.86);
    expect(aa + kk).toBeCloseTo(1, 5);
    // One card to come: KK needs one of the two remaining kings out of 44 rivers.
    const [, kkTurn] = equities([parseCards("As Ah"), parseCards("Ks Kh")], parseCards("2c 7d 9s Jc"));
    expect(kkTurn).toBeCloseTo(2 / 44, 5);
  });

  it("splits ties", () => {
    const [a, b] = equities([parseCards("2c 3d"), parseCards("2h 3s")], parseCards("As Ks Qs Js Ts"));
    expect(a).toBe(0.5);
    expect(b).toBe(0.5);
  });
});

describe("analyzeHand", () => {
  it("counts a bluff when a better hand folds to your bet", () => {
    const g = hand([player("7c 2d"), player("Ah Qd")], [act(0, "call"), act(1, "check"), street("flop", "As Kd 9h"), act(1, "check"), act(0, "bet", 20), act(1, "fold")], {
      payouts: { 0: 40 }, pots: [{ amount: 60, winners: [0] }],
    });
    const facts = analyzeHand(g);
    expect(facts[0].bluff?.beforeRiver).toBe(true);
    expect(facts[0].bluff?.pot).toBe(60);
    expect(facts[0].bluff!.equity).toBeLessThan(0.1);
    expect(facts[0].bluff?.allIn).toBe(false);
    expect(facts[0].won72).toBe(true);
    expect(facts[0].won72Showdown).toBe(false);
  });

  it("flags a bluff made with an all-in", () => {
    const shove: LogEvent = { kind: "action", player: 0, action: "bet", amount: 900, allIn: true };
    const g = hand([player("7c 2d"), player("Ah Qd")], [act(0, "call"), act(1, "check"), street("flop", "As Kd 9h"), act(1, "check"), shove, act(1, "fold")], {
      payouts: { 0: 20 },
    });
    expect(analyzeHand(g)[0].bluff?.allIn).toBe(true);
  });

  it("doesn't count a semi-bluff with real equity", () => {
    // Flush draw plus overcards against top pair is close to a coin flip, not a bluff.
    const g = hand([player("Kh Qh"), player("Ad 9c")], [act(0, "call"), act(1, "check"), street("flop", "As 7h 2h"), act(1, "check"), act(0, "bet", 20), act(1, "fold")], {
      payouts: { 0: 40 },
    });
    expect(analyzeHand(g)[0].bluff).toBeNull();
  });

  it("doesn't call it a bluff when you were ahead, or preflop", () => {
    const ahead = hand([player("Ac Kc"), player("3h 3d")], [act(0, "call"), act(1, "check"), street("flop", "As Kd 9h"), act(1, "check"), act(0, "bet", 20), act(1, "fold")], {
      payouts: { 0: 40 },
    });
    expect(analyzeHand(ahead)[0].bluff).toBeNull();
    const preflop = hand([player("7c 2d"), player("Ah Ad")], [act(0, "raise", 30), act(1, "fold")], { payouts: { 0: 15 } });
    expect(analyzeHand(preflop)[0].bluff).toBeNull();
  });

  it("records all-in equity for a suckout and the bad beat it caused", () => {
    const board = "2c 7d 9s Jc";
    const g = hand(
      [player("Ks Kh", { allIn: true }), player("As Ah")],
      [act(0, "call"), act(1, "check"), street("flop", "2c 7d 9s"), street("turn", "Jc"), act(1, "bet", 100), act(0, "call", 100), street("river", "Kd")],
      { showdown: true, payouts: { 0: 200 }, hands: { 0: shown("Ks Kh", `${board} Kd`), 1: shown("As Ah", `${board} Kd`) } },
    );
    const facts = analyzeHand(g);
    expect(facts[0].allIn).toEqual({ equity: 2 / 44, won: true });
    expect(facts[0].allInWin).toBe(true);
    expect(facts[1].allInWin).toBe(false);
    expect(facts[1].allIn?.won).toBe(false);
    expect(facts[1].allIn?.equity).toBeCloseTo(42 / 44, 5);
  });

  it("ignores river all-ins and checked-down showdowns", () => {
    const board = "2c 7d 9s Jc Kd";
    const g = hand(
      [player("Ks Kh"), player("As Ah")],
      [street("flop", "2c 7d 9s"), street("turn", "Jc"), street("river", "Kd"), act(1, "bet", 100), act(0, "call", 100)],
      { showdown: true, payouts: { 0: 200 }, hands: { 0: shown("Ks Kh", board), 1: shown("As Ah", board) } },
    );
    expect(analyzeHand(g)[0].allIn).toBeNull();
    expect(analyzeHand(g)[0].allInWin).toBe(false);
  });
});
