import { describe, expect, it } from "vitest";
import { parseCards } from "./cards";
import { HandCategory, evaluate, describeHand } from "./evaluator";
import {
  type GameState,
  type LogEvent,
  type SeatInfo,
  applyAction,
  buildPots,
  createGame,
  legalActions,
  positionLabels,
  potTotal,
  startHand,
} from "./game";
import { STARTING_STACK } from "./modes";
import { ratingChanges } from "../rating";

const seats = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true }));

const totalChips = (s: GameState) => s.players.reduce((sum, p) => sum + p.stack + p.totalBet, 0);

describe("evaluator", () => {
  const cat = (t: string) => evaluate(parseCards(t)).category;

  it("classifies categories", () => {
    expect(cat("As Ks Qs Js Ts 2c 3d")).toBe(HandCategory.StraightFlush);
    expect(cat("9h 9d 9s 9c 2d 3d 4h")).toBe(HandCategory.Quads);
    expect(cat("9h 9d 9s 5c 5d 3d 4h")).toBe(HandCategory.FullHouse);
    expect(cat("9h 9d 9s 5c 5d 5h 4h")).toBe(HandCategory.FullHouse);
    expect(cat("2h 7h 9h Jh Kh 3d 4c")).toBe(HandCategory.Flush);
    expect(cat("Ah 2d 3s 4c 5d 9d Kh")).toBe(HandCategory.Straight);
    expect(cat("7h 7d 7s Kc 2d 3d 9h")).toBe(HandCategory.Trips);
    expect(cat("7h 7d Ks Kc 2d 3d 9h")).toBe(HandCategory.TwoPair);
    expect(cat("7h 7d Ks Qc 2d 3d 9h")).toBe(HandCategory.Pair);
    expect(cat("7h 8d Ks Qc 2d 3d 9h")).toBe(HandCategory.HighCard);
  });

  it("compares kickers and wheel straights", () => {
    const a = evaluate(parseCards("Ah Kd 7s 7c 2d"));
    const b = evaluate(parseCards("Qh Kd 7s 7c 2d"));
    expect(a.score).toBeGreaterThan(b.score);
    const wheel = evaluate(parseCards("Ah 2d 3s 4c 5d"));
    const six = evaluate(parseCards("6h 2d 3s 4c 5d"));
    expect(six.score).toBeGreaterThan(wheel.score);
    expect(describeHand(wheel)).toBe("Straight, Five high");
  });

  it("picks the best two pair out of three pairs", () => {
    const v = evaluate(parseCards("Ah Ad Ks Kc 2d 2c 9h"));
    expect(v.ranks).toEqual([14, 13, 9]);
  });
});

describe("side pots", () => {
  it("splits contributions into main and side pots", () => {
    const g = startHand(createGame({ mode: "standard", seats: seats(3), seed: 1 }));
    g.players[0].totalBet = 50;
    g.players[1].totalBet = 200;
    g.players[2].totalBet = 200;
    const pots = buildPots(g.players);
    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 300, eligible: [1, 2] },
    ]);
  });

  it("folded players' chips stay in the pot but they can't win it", () => {
    const g = startHand(createGame({ mode: "standard", seats: seats(3), seed: 1 }));
    g.players[0].totalBet = 100;
    g.players[0].folded = true;
    g.players[1].totalBet = 100;
    g.players[2].totalBet = 100;
    expect(buildPots(g.players)).toEqual([{ amount: 300, eligible: [1, 2] }]);
  });
});

describe("game flow", () => {
  it("posts blinds and gives the BB the option", () => {
    let g = startHand(createGame({ mode: "standard", seats: seats(4), seed: 7 }));
    expect(potTotal(g)).toBe(15);
    // Everyone limps to the BB.
    while (g.toAct !== g.bbIndex) g = applyAction(g, { type: "call" });
    const legal = legalActions(g)!;
    expect(legal.canCheck).toBe(true);
    expect(legal.canRaise).toBe(true);
    g = applyAction(g, { type: "check" });
    expect(g.street).toBe("flop");
    expect(g.board).toHaveLength(3);
  });

  it("heads-up: button posts SB and acts first preflop, last postflop", () => {
    let g = startHand(createGame({ mode: "headsup", seats: seats(2), seed: 3 }));
    expect(g.sbIndex).toBe(g.button);
    expect(g.toAct).toBe(g.button);
    g = applyAction(g, { type: "call" });
    g = applyAction(g, { type: "check" });
    expect(g.street).toBe("flop");
    expect(g.toAct).toBe(g.bbIndex);
  });

  it("returns an uncalled bet and awards the pot when everyone folds", () => {
    let g = startHand(createGame({ mode: "standard", seats: seats(3), seed: 5 }));
    const raiser = g.toAct!;
    g = applyAction(g, { type: "raise", to: 60 });
    g = applyAction(g, { type: "fold" });
    g = applyAction(g, { type: "fold" });
    expect(g.phase).toBe("complete");
    // Raiser wins the blinds; the uncalled 45 above the BB comes back.
    expect(g.players[raiser].stack).toBe(STARTING_STACK + 15);
    expect(totalChips(g)).toBe(3 * STARTING_STACK);
  });

  it("an incomplete all-in raise does not reopen raising", () => {
    let g = startHand(createGame({ mode: "standard", seats: seats(3), seed: 11 }));
    const [a, b, c] = [g.toAct!, g.sbIndex, g.bbIndex];
    g.players[b].stack = 45; // SB has 50 total after posting 5
    g = applyAction(g, { type: "raise", to: 40 }); // A raises to 40 (raise of 30)
    g = applyAction(g, { type: "raise", to: 50 }); // SB all-in for 50: only +10
    expect(g.players[b].allIn).toBe(true);
    g = applyAction(g, { type: "call" }); // BB calls 50
    expect(g.toAct).toBe(a);
    expect(legalActions(g)!.canRaise).toBe(false);
    expect(g.players[c].bet).toBe(50);
  });

  it("runs out the board when everyone is all-in and conserves chips", () => {
    let g = startHand(createGame({ mode: "standard", seats: seats(3), seed: 42 }));
    g = applyAction(g, { type: "raise", to: legalActions(g)!.maxRaiseTo });
    g = applyAction(g, { type: "call" });
    g = applyAction(g, { type: "call" });
    expect(g.board).toHaveLength(5);
    expect(["complete", "finished"]).toContain(g.phase);
    expect(g.result!.showdown).toBe(true);
    expect(totalChips(g)).toBe(3 * STARTING_STACK);
  });

  it("labels 8-max positions", () => {
    const g = startHand(createGame({ mode: "standard", seats: seats(8), seed: 2 }));
    const labels = Object.values(positionLabels(g)).sort();
    expect(labels).toEqual(["BB", "BTN", "CO", "HJ", "MP", "SB", "UTG", "UTG+1"].sort());
  });

  it("plays random games to completion with unique placements and conserved chips", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let rng = seed;
      const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
      let g = createGame({ mode: "turbo", seats: seats(8), seed });
      let guard = 0;
      while (g.phase !== "finished" && guard++ < 20000) {
        if (g.phase !== "betting") {
          g = startHand(g);
          continue;
        }
        const legal = legalActions(g)!;
        const r = rand();
        if (legal.canRaise && r < 0.2) {
          const to = legal.minRaiseTo + Math.floor(rand() * (legal.maxRaiseTo - legal.minRaiseTo + 1));
          g = applyAction(g, { type: "raise", to });
        } else if (!legal.canCheck && r < 0.45) {
          g = applyAction(g, { type: "fold" });
        } else {
          g = applyAction(g, { type: "call" });
        }
        expect(totalChips(g)).toBe(8 * STARTING_STACK);
      }
      expect(g.phase).toBe("finished");
      const places = g.players.map((p) => p.place).sort((x, y) => x! - y!);
      expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const winner = g.players.find((p) => p.place === 1)!;
      expect(winner.stack).toBe(8 * STARTING_STACK);
    }
  });
});

describe("rating", () => {
  const lobby = (ratings: number[]) =>
    ratings.map((rating, i) => ({ id: `p${i}`, rating, place: i + 1, gamesPlayed: 100 }));

  it("gives the TFT-style spread in an even lobby", () => {
    const d = ratingChanges(lobby(Array(8).fill(1500)));
    expect(Object.values(d)).toEqual([35, 25, 15, 5, -5, -15, -25, -35]);
  });

  it("rewards beating a stronger lobby more", () => {
    const d = ratingChanges(lobby([1500, 1600, 1600, 1600, 1600, 1600, 1600, 1600]));
    expect(d.p0).toBe(45);
  });

  it("heads-up is plain Elo", () => {
    const d = ratingChanges(lobby([1500, 1500]));
    expect(d).toEqual({ p0: 16, p1: -16 });
  });
});

describe("stats", () => {
  it("counts VPIP and PFR but not blinds", async () => {
    const { accumulateHand } = await import("../stats");
    const events: LogEvent[] = [
      { kind: "post", player: 1, amount: 5, blind: "SB" },
      { kind: "post", player: 2, amount: 10, blind: "BB" },
      { kind: "action", player: 0, action: "raise", amount: 30, allIn: false },
      { kind: "action", player: 1, action: "call", amount: 25, allIn: false },
      { kind: "action", player: 2, action: "fold", amount: 0, allIn: false },
      { kind: "street", street: "flop", cards: [] },
      { kind: "action", player: 1, action: "bet", amount: 40, allIn: false },
      { kind: "action", player: 0, action: "call", amount: 40, allIn: false },
      { kind: "win", player: 1, amount: 150, hand: null },
    ];
    const t = accumulateHand({}, events, { 0: "a", 1: "b", 2: "c" });
    expect(t.a).toMatchObject({ hands: 1, vpip: 1, pfr: 1, passive: 1 });
    expect(t.b).toMatchObject({ hands: 1, vpip: 1, pfr: 0, aggressive: 1, handsWon: 1 });
    expect(t.c).toMatchObject({ hands: 1, vpip: 0, pfr: 0 });
  });
});
