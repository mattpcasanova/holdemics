/**
 * Table geometry, in percent of a fixed stage that PokerTable scales to fit.
 * Pure functions so every table size can be checked for overlaps in tests.
 */

export type Point = { x: number; y: number };

/**
 * The table is laid out on a fixed-size stage and scaled to fit, so seats,
 * cards, and chips keep their proportions on every screen. Tall, narrow
 * containers (phones) get a portrait stage with seats in two columns.
 */
export const STAGES = {
  landscape: { w: 1000, h: 640, felt: "9% 7% 12%", boardTop: 45, board: "md" as const },
  portrait: { w: 540, h: 880, felt: "8% 11% 9%", boardTop: 44, board: "sm" as const },
};
export const DEALER: Point = { x: 50, y: 40 };

export function ellipsePoint(offset: number, seats: number, radius = 1): Point {
  const angle = ((90 + (offset * 360) / seats) * Math.PI) / 180;
  return { x: 50 + 44 * radius * Math.cos(angle), y: 51 + 40 * radius * Math.sin(angle) };
}

const PORTRAIT_8: Point[] = [
  { x: 50, y: 88 },
  { x: 15, y: 73 },
  { x: 15, y: 52 },
  { x: 15, y: 29 },
  { x: 50, y: 12 },
  { x: 85, y: 29 },
  { x: 85, y: 52 },
  { x: 85, y: 73 },
];

/** Seat centers by offset from the hero (0 = hero, then clockwise). */
export function seatLayout(n: number, portrait: boolean): Point[] {
  if (!portrait) return Array.from({ length: n }, (_, k) => ellipsePoint(k, n));
  if (n === 2) return [PORTRAIT_8[0], PORTRAIT_8[4]];
  if (n === 8) return PORTRAIT_8;
  return Array.from({ length: n }, (_, k) => {
    const a = ((90 + (k * 360) / n) * Math.PI) / 180;
    return { x: 50 + 36 * Math.cos(a), y: 50 + 38 * Math.sin(a) };
  });
}

/** Footprints in stage pixels, measured in the browser (a bet: two chip stacks over a three-digit amount). */
export const FOOTPRINT = {
  bet: { w: 72, h: 56 },
  seat: { w: 148, h: 128 },
  hero: { w: 176, h: 166 },
  board: { portrait: { w: 234, h: 103 }, landscape: { w: 304, h: 122 } },
};

const BET_GAP = 6;

type Rect = { cx: number; cy: number; w: number; h: number };

/** The two ways to push `a` clear of `b` (sideways or vertically), smaller first; null if they're clear. */
function separations(a: Rect, b: Rect): { dx: number; dy: number }[] | null {
  const ox = (a.w + b.w) / 2 + BET_GAP - Math.abs(a.cx - b.cx);
  const oy = (a.h + b.h) / 2 + BET_GAP - Math.abs(a.cy - b.cy);
  if (ox <= 0 || oy <= 0) return null;
  const sideways = { dx: (a.cx >= b.cx ? 1 : -1) * ox, dy: 0 };
  const vertical = { dx: 0, dy: (a.cy >= b.cy ? 1 : -1) * oy };
  return ox < oy ? [sideways, vertical] : [vertical, sideways];
}

const betCache = new Map<string, Point[]>();

/**
 * Where each seat's bet sits (by offset from the hero, like seatLayout).
 * Bets start on the line from the seat toward the middle of the table, just
 * clear of the seat, then any that still touch another bet, a seat, or the
 * board are nudged apart. Works for every table size in both orientations.
 */
export function betPoints(n: number, portrait: boolean): Point[] {
  const key = `${n}:${portrait}`;
  const cached = betCache.get(key);
  if (cached) return cached;

  const stage = portrait ? STAGES.portrait : STAGES.landscape;
  const toPx = (p: Point) => ({ x: (p.x / 100) * stage.w, y: (p.y / 100) * stage.h });
  const center = toPx({ x: 50, y: stage.boardTop });
  const board: Rect = { cx: center.x, cy: center.y, ...FOOTPRINT.board[portrait ? "portrait" : "landscape"] };
  const seats: Rect[] = seatLayout(n, portrait).map((p, i) => ({ cx: toPx(p).x, cy: toPx(p).y, ...(i === 0 ? FOOTPRINT.hero : FOOTPRINT.seat) }));
  const { w: bw, h: bh } = FOOTPRINT.bet;

  const bets: Rect[] = seats.map((s) => {
    const dx = center.x - s.cx;
    const dy = center.y - s.cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Distance along the ray at which a box of half-size (hw, hh) is fully out of the seat.
    const exit = (hw: number, hh: number) => Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity);
    const t = exit(s.w / 2, s.h / 2) + exit(bw / 2, bh / 2) + BET_GAP;
    return { cx: s.cx + ux * t, cy: s.cy + uy * t, w: bw, h: bh };
  });

  const obstacles = [...seats, board];
  const blocked = (r: Rect) => obstacles.some((o) => separations(r, o));
  const conflicts = (r: Rect, self: number) => blocked(r) || bets.some((other, k) => k !== self && separations(r, other));
  const clamp = (b: Rect) => {
    b.cx = Math.min(stage.w - bw / 2, Math.max(bw / 2, b.cx));
    b.cy = Math.min(stage.h - bh / 2, Math.max(bh / 2, b.cy));
  };
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < bets.length; i++) {
      const b = bets[i];
      for (const obstacle of obstacles) {
        const options = separations(b, obstacle);
        if (!options) continue;
        // Take the first direction that leaves this bet clear of everything, else the smaller push.
        const push = options.find(({ dx, dy }) => !conflicts({ ...b, cx: b.cx + dx, cy: b.cy + dy }, i)) ?? options[0];
        b.cx += push.dx;
        b.cy += push.dy;
        moved = true;
      }
      for (let j = i + 1; j < bets.length; j++) {
        const options = separations(b, bets[j]);
        if (!options) continue;
        // Split the move between the two bets, preferring a direction that keeps both off seats and the board.
        const shifted = (r: Rect, dx: number, dy: number): Rect => ({ ...r, cx: r.cx + dx, cy: r.cy + dy });
        const push =
          options.find(({ dx, dy }) => !blocked(shifted(b, dx / 2, dy / 2)) && !blocked(shifted(bets[j], -dx / 2, -dy / 2))) ?? options[0];
        b.cx += push.dx / 2;
        b.cy += push.dy / 2;
        bets[j].cx -= push.dx / 2;
        bets[j].cy -= push.dy / 2;
        moved = true;
      }
      clamp(b);
    }
    if (!moved) break;
  }

  const result = bets.map((b) => ({ x: (b.cx / stage.w) * 100, y: (b.cy / stage.h) * 100 }));
  betCache.set(key, result);
  return result;
}

export function dealerButtonPoint(seat: Point, offset: number, n: number, portrait: boolean): Point {
  if (!portrait) return ellipsePoint(offset + 0.32, n, 0.7);
  // Just inside the seat box, toward the middle of the table.
  if (Math.abs(seat.x - 50) < 10) return { x: seat.x + 19, y: seat.y + (seat.y < 50 ? 6 : -6) };
  return { x: seat.x + Math.sign(50 - seat.x) * 18, y: seat.y - 6 };
}
