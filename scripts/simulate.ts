/**
 * Bot-vs-bot simulation for tuning blind speed and bot strength.
 * Usage: npx tsx scripts/simulate.ts [mode] [games]
 */
import { type BotLevel, decideBotAction } from "../src/lib/engine/bots";
import { applyAction, createGame, startHand } from "../src/lib/engine/game";
import type { ModeId } from "../src/lib/engine/modes";
import { MODES } from "../src/lib/engine/modes";

const mode = (process.argv[2] ?? "standard") as ModeId;
const games = Number(process.argv[3] ?? 50);
const seats = MODES[mode].seats;
const levels: BotLevel[] = Array.from({ length: seats }, (_, i) => (["easy", "medium", "hard"] as const)[i % 3]);

const hands: number[] = [];
const placeSum: Record<BotLevel, { sum: number; n: number }> = {
  easy: { sum: 0, n: 0 }, medium: { sum: 0, n: 0 }, hard: { sum: 0, n: 0 },
};
const t0 = Date.now();

for (let g = 0; g < games; g++) {
  let s = createGame({
    mode,
    seed: 1000 + g,
    seats: levels.map((l, i) => ({ id: `b${i}`, name: `${l}${i}`, isBot: true })),
  });
  while (s.phase !== "finished") {
    s = s.phase === "betting" ? applyAction(s, decideBotAction(s, levels[s.toAct!])) : startHand(s);
  }
  hands.push(s.handNumber);
  s.players.forEach((p, i) => {
    placeSum[levels[i]].sum += p.place!;
    placeSum[levels[i]].n++;
  });
}

hands.sort((a, b) => a - b);
const avg = hands.reduce((a, b) => a + b, 0) / hands.length;
console.log(`${mode}: ${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`hands/game avg ${avg.toFixed(1)}  median ${hands[hands.length >> 1]}  p90 ${hands[Math.floor(hands.length * 0.9)]}`);
for (const [lvl, v] of Object.entries(placeSum)) if (v.n) console.log(`  ${lvl.padEnd(6)} avg place ${(v.sum / v.n).toFixed(2)}`);
