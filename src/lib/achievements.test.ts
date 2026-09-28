import { describe, expect, it } from "vitest";
import { type GameFacts, type PlayerTotals, ACHIEVEMENTS, gameAchievements, milestoneAchievements } from "./achievements";
import { CARD_BACKS, TABLE_SKINS, TITLES } from "./cosmetics";
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
  ledFromHalf: false,
  ledSinceFirstBust: false,
  knockouts: 1,
  worstShowdownLoss: null,
  survivedAllInShort: false,
};

describe("game achievements", () => {
  it("tiers Comeback by how low you got", () => {
    expect(gameAchievements({ ...base, minStack: 250 })).toEqual(expect.arrayContaining(["comeback_1"]));
    expect(gameAchievements({ ...base, minStack: 250 })).not.toContain("comeback_2");
    expect(gameAchievements({ ...base, minStack: 100 })).toEqual(expect.arrayContaining(["comeback_1", "comeback_2"]));
    expect(gameAchievements({ ...base, minStack: 30 })).toContain("comeback_3");
    expect(gameAchievements({ ...base, minStack: 30, place: 2 })).not.toContain("comeback_1");
  });

  it("tiers Domination and needs an 8-player win", () => {
    expect(gameAchievements({ ...base, ledFromFinalFour: true })).toContain("domination_1");
    expect(gameAchievements({ ...base, ledFromHalf: true })).toContain("domination_2");
    expect(gameAchievements({ ...base, ledSinceFirstBust: true })).toContain("domination_3");
    expect(gameAchievements({ ...base, ledSinceFirstBust: true, players: 6 })).not.toContain("domination_3");
  });

  it("tiers Bounty by knockouts", () => {
    expect(gameAchievements({ ...base, knockouts: 3, place: 4 })).toEqual(["bounty_1"]);
    expect(gameAchievements({ ...base, knockouts: 7, place: 1, minStack: 900 })).toEqual(expect.arrayContaining(["bounty_1", "bounty_2", "bounty_3"]));
  });

  it("awards Clean Sweep only for real games, and Cooler / Bad Beat / Houdini", () => {
    expect(gameAchievements(base)).toContain("clean_sweep");
    expect(gameAchievements({ ...base, handsPlayed: 1 })).not.toContain("clean_sweep");
    expect(gameAchievements({ ...base, worstShowdownLoss: HandCategory.FullHouse, place: 8 })).toEqual(["cooler_1"]);
    expect(gameAchievements({ ...base, worstShowdownLoss: HandCategory.Quads, place: 8 })).toEqual(["cooler_1", "cooler_2"]);
    expect(gameAchievements({ ...base, survivedAllInShort: true, minStack: 900 })).toContain("houdini");
  });
});

describe("milestone achievements", () => {
  const totals: PlayerTotals = { rankedGames: 1, rankedWins: 1, headsUpWins: 1, winStreak: 1, rating: 1532, rank: 1 };

  it("awards Ship It on the first ranked win and streaks", () => {
    expect(milestoneAchievements(totals, "headsup")).toContain("ship_it");
    expect(milestoneAchievements({ ...totals, rankedWins: 0, winStreak: 0 }, "headsup")).not.toContain("ship_it");
    expect(milestoneAchievements({ ...totals, winStreak: 3 }, "headsup")).toContain("heater");
    expect(milestoneAchievements({ ...totals, winStreak: 5 }, "headsup")).toContain("unstoppable");
  });

  it("holds tier achievements until placement is done", () => {
    expect(milestoneAchievements({ ...totals, rating: 2100 }, "headsup")).not.toContain("tier_shark");
    const placed = { ...totals, rankedGames: 20, rating: 2100, rank: 3 };
    expect(milestoneAchievements(placed, "headsup")).toEqual(expect.arrayContaining(["tier_grinder", "tier_pro", "tier_crusher", "tier_shark", "tier_nuts", "reps_10"]));
  });
});

describe("catalogue", () => {
  it("every reward points at a real cosmetic, and every unlockable cosmetic has an achievement", () => {
    for (const a of ACHIEVEMENTS) {
      const pool = a.reward.kind === "title" ? TITLES : a.reward.kind === "cardBack" ? CARD_BACKS : TABLE_SKINS;
      expect(pool[a.reward.id], `${a.id} -> ${a.reward.kind}:${a.reward.id}`).toBeDefined();
      expect(pool[a.reward.id].unlock).toBe(a.id);
    }
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const c of [...Object.values(CARD_BACKS), ...Object.values(TABLE_SKINS), ...Object.values(TITLES)]) {
      if (c.unlock) expect(ids.has(c.unlock), `${c.id} unlocked by ${c.unlock}`).toBe(true);
    }
  });

  it("rarer achievements never hand out a plainer reward than commoner ones of the same kind", () => {
    const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    for (const a of ACHIEVEMENTS) {
      const pool = a.reward.kind === "title" ? TITLES : a.reward.kind === "cardBack" ? CARD_BACKS : TABLE_SKINS;
      expect(order[pool[a.reward.id].rarity], a.id).toBe(order[a.rarity]);
    }
  });
});
