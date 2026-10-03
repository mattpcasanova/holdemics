import { describe, expect, it } from "vitest";
import { type GameFacts, type PlayerTotals, ACHIEVEMENTS, careerAchievements, gameAchievements, inGameAchievements, milestoneAchievements } from "./achievements";
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
  pots72: 0,
  won72Showdown: false,
  bluffs: 0,
  stoneColdBluff: false,
  biggestBluffPot: 0,
  shoveBluff: false,
  allInWins: 0,
  bestSuckout: null,
  worstBeat: null,
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

describe("moves and luck", () => {
  const loser = { ...base, place: 5, minStack: 500, knockouts: 0 };

  it("awards The Hammer for any 7-2 pot and Hammer Time at showdown", () => {
    expect(gameAchievements({ ...loser, pots72: 1 })).toEqual(["hammer_1"]);
    expect(gameAchievements({ ...loser, pots72: 1, won72Showdown: true })).toEqual(["hammer_1", "hammer_2"]);
    expect(careerAchievements({ bluffs: 0, pots72: 9, allInWins: 0 })).toEqual([]);
    expect(careerAchievements({ bluffs: 0, pots72: 100, allInWins: 0 })).toEqual(["hammer_3", "hammer_4"]);
  });

  it("awards all-in wins over a career and the all-in bluff", () => {
    expect(careerAchievements({ bluffs: 0, pots72: 0, allInWins: 49 })).toEqual(["allin_1"]);
    expect(careerAchievements({ bluffs: 0, pots72: 0, allInWins: 250 })).toEqual(["allin_1", "allin_2", "allin_3"]);
    expect(gameAchievements({ ...loser, bluffs: 1, shoveBluff: true })).toEqual(["bluff_shove"]);
  });

  it("gives every count-based tier a progress goal that matches its rule", () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.progress)) expect(a.progress!.target).toBeGreaterThan(1);
    const bluffTargets = ACHIEVEMENTS.filter((a) => a.progress?.stat === "bluffs").map((a) => a.progress!.target);
    for (const t of bluffTargets) {
      expect(careerAchievements({ bluffs: t - 1, pots72: 0, allInWins: 0 }).length).toBeLessThan(careerAchievements({ bluffs: t, pots72: 0, allInWins: 0 }).length);
    }
  });

  it("awards bluff levels", () => {
    expect(gameAchievements({ ...loser, bluffs: 1, stoneColdBluff: true })).toEqual(["bluff_stone"]);
    expect(gameAchievements({ ...loser, bluffs: 1, biggestBluffPot: 490 })).toEqual([]);
    expect(gameAchievements({ ...loser, bluffs: 1, biggestBluffPot: 500 })).toEqual(["bluff_big"]);
  });

  it("awards in-game achievements without knowing the winner", () => {
    const winner = { ...base, minStack: 200, pots72: 1 };
    expect(gameAchievements(winner)).toEqual(expect.arrayContaining(["comeback_1", "hammer_1"]));
    expect(inGameAchievements(winner)).toEqual(["hammer_1"]);
  });

  it("counts bluffs per game and over a career", () => {
    expect(gameAchievements({ ...loser, bluffs: 2 })).toEqual([]);
    expect(gameAchievements({ ...loser, bluffs: 3 })).toEqual(["bluff_game"]);
    expect(careerAchievements({ bluffs: 9, pots72: 0, allInWins: 0 })).toEqual([]);
    expect(careerAchievements({ bluffs: 50, pots72: 0, allInWins: 0 })).toEqual(["bluff_1", "bluff_2"]);
    expect(careerAchievements({ bluffs: 200, pots72: 0, allInWins: 0 })).toEqual(["bluff_1", "bluff_2", "bluff_3"]);
  });

  it("tiers suckouts and bad beats by equity", () => {
    expect(gameAchievements({ ...loser, bestSuckout: 0.3 })).toEqual([]);
    expect(gameAchievements({ ...loser, bestSuckout: 0.2 })).toEqual(["suckout_1"]);
    expect(gameAchievements({ ...loser, bestSuckout: 0.02 })).toEqual(["suckout_1", "suckout_2", "suckout_3"]);
    expect(gameAchievements({ ...loser, worstBeat: 0.79 })).toEqual([]);
    expect(gameAchievements({ ...loser, worstBeat: 0.91 })).toEqual(["badbeat_1", "badbeat_2"]);
    expect(gameAchievements({ ...loser, worstBeat: 0.98 })).toEqual(["badbeat_1", "badbeat_2", "badbeat_3"]);
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
