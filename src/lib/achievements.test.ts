import { describe, expect, it } from "vitest";
import { type GameFacts, type PlayerTotals, ACHIEVEMENTS, gameAchievements, milestoneAchievements } from "./achievements";
import { HandCategory } from "./engine/evaluator";
import { STARTING_STACK } from "./engine/modes";

const base: GameFacts = {
  mode: "standard",
  ranked: true,
  players: 8,
  place: 1,
  handsPlayed: 30,
  minStack: STARTING_STACK,
  ledFromFinalFour: false,
  knockouts: 1,
  worstShowdownLoss: null,
  survivedAllIn: false,
};

describe("game achievements", () => {
  it("awards Comeback for winning from 10 HP or less", () => {
    expect(gameAchievements({ ...base, minStack: 100 })).toContain("comeback");
    expect(gameAchievements({ ...base, minStack: 110 })).not.toContain("comeback");
    expect(gameAchievements({ ...base, minStack: 50, place: 2 })).not.toContain("comeback");
  });

  it("awards Domination only in 8-player wins led from the final four", () => {
    expect(gameAchievements({ ...base, ledFromFinalFour: true })).toContain("domination");
    expect(gameAchievements({ ...base, ledFromFinalFour: true, players: 2 })).not.toContain("domination");
    expect(gameAchievements({ ...base, ledFromFinalFour: true, place: 3 })).not.toContain("domination");
  });

  it("awards Clean Sweep for never dropping below the starting stack", () => {
    expect(gameAchievements(base)).toContain("clean_sweep");
    expect(gameAchievements({ ...base, minStack: STARTING_STACK - 5 })).not.toContain("clean_sweep");
  });

  it("awards Bully, Cooler and Houdini", () => {
    expect(gameAchievements({ ...base, knockouts: 4, place: 5 })).toContain("bully");
    expect(gameAchievements({ ...base, worstShowdownLoss: HandCategory.FullHouse, place: 8 })).toContain("cooler");
    expect(gameAchievements({ ...base, worstShowdownLoss: HandCategory.Flush, place: 8 })).not.toContain("cooler");
    expect(gameAchievements({ ...base, survivedAllIn: true })).toContain("houdini");
  });
});

describe("milestone achievements", () => {
  const totals: PlayerTotals = { rankedGames: 1, rankedWins: 1, headsUpWins: 1, rating: 1532, rank: 1 };

  it("awards First Blood on the first ranked win", () => {
    expect(milestoneAchievements(totals, "headsup")).toContain("first_blood");
    expect(milestoneAchievements({ ...totals, rankedWins: 0 }, "headsup")).not.toContain("first_blood");
  });

  it("holds tier achievements until placement is done", () => {
    expect(milestoneAchievements({ ...totals, rating: 2100 }, "headsup")).not.toContain("tier_shark");
    const placed = { ...totals, rankedGames: 20, rating: 2100, rank: 3 };
    const earned = milestoneAchievements(placed, "headsup");
    expect(earned).toEqual(expect.arrayContaining(["tier_grinder", "tier_pro", "tier_crusher", "tier_shark", "tier_nuts", "regular_10"]));
  });

  it("every rule id exists in the catalogue", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of [...gameAchievements({ ...base, knockouts: 4, survivedAllIn: true, minStack: 0, ledFromFinalFour: true }), ...milestoneAchievements({ rankedGames: 100, rankedWins: 10, headsUpWins: 10, rating: 2500, rank: 1 }, "headsup")]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
