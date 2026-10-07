import { describe, expect, it } from "vitest";
import { type Point, FOOTPRINT, STAGES, betPoints, seatLayout } from "./layout";

/**
 * Everyone at the table has a bet out at once (the worst case): no bet may
 * cover another bet, any seat, or the board and pot. Sizes are stage pixels,
 * measured in the browser with a three-digit amount on two chip stacks.
 */
const { bet: BET, seat: SEAT, hero: HERO, board: BOARD } = FOOTPRINT;

type Box = { left: number; right: number; top: number; bottom: number; label: string };

function box(at: Point, size: { w: number; h: number }, stage: { w: number; h: number }, label: string): Box {
  const cx = (at.x / 100) * stage.w;
  const cy = (at.y / 100) * stage.h;
  return { left: cx - size.w / 2, right: cx + size.w / 2, top: cy - size.h / 2, bottom: cy + size.h / 2, label: `${label} @${Math.round(cx)},${Math.round(cy)}` };
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const orientation of ["portrait", "landscape"] as const) {
  describe(`${orientation} table layout`, () => {
    for (let n = 2; n <= 9; n++) {
      it(`keeps every bet clear with ${n} seats`, () => {
        const stage = STAGES[orientation];
        const portrait = orientation === "portrait";
        const seats = seatLayout(n, portrait);
        const seatBoxes = seats.map((p, i) => box(p, i === 0 ? HERO : SEAT, stage, `seat ${i}`));
        const bets = betPoints(n, portrait);
        const betBoxes = seats.map((_, i) => box(bets[i], BET, stage, `bet ${i}`));
        const board = box({ x: 50, y: stage.boardTop }, BOARD[orientation], stage, "board");
        const problems: string[] = [];
        betBoxes.forEach((b, i) => {
          betBoxes.forEach((c, j) => j > i && overlaps(b, c) && problems.push(`${b.label} x ${c.label}`));
          seatBoxes.forEach((s) => overlaps(b, s) && problems.push(`${b.label} x ${s.label}`));
          if (overlaps(b, board)) problems.push(`${b.label} x board`);
          if (b.left < 0 || b.right > stage.w || b.top < 0 || b.bottom > stage.h) problems.push(`${b.label} off stage`);
        });
        expect(problems).toEqual([]);
      });
    }
  });
}
