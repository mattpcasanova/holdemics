"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/table/ChipStack";
import { PlayingCard } from "@/components/table/PlayingCard";
import type { Card } from "@/lib/engine/cards";

/**
 * One hand from the dealer's chair, on a slow loop: riffle and strip the
 * deck, post blinds, pitch two cards to every seat, the action goes round
 * (folds to the muck, calls and a raise pushed in), bets are collected,
 * the board comes out street by street, the pot goes to the winner, the
 * hand rests, and everything sweeps back to the dealer. Pure CSS
 * animations on a tilted plane; every element's timeline is a list of
 * chained animations, later ones (`forwards`) taking over from earlier.
 */

const W = 640;
const H = 420;
const TILT = 54;
const CENTER = { x: W / 2, y: 210 };
const DEALER = { x: 320, y: 372 };
const DECK = { x: 268, y: 352 };
const MUCK = { x: 372, y: 352 };
const POT = { x: 320, y: 268 };
const CARD = { w: 42, h: 59 };
const BOARD_CARD = { w: 56, h: 78 };
const BOARD_Y = 196;
const boardX = (i: number) => W / 2 + (i - 2) * 64;

// ─── Timeline (ms) ───────────────────────────────────────
const BLINDS_AT = 1500;
const DEAL_START = 1850;
const DEAL_STAGGER = 80;
const PREFLOP: Action[] = [
  { seat: 2, at: 3350, kind: "fold" },
  { seat: 3, at: 3600, kind: "bet", amount: 90 },
  { seat: 4, at: 3850, kind: "bet", amount: 90 },
  { seat: 5, at: 4100, kind: "fold" },
  { seat: 6, at: 4350, kind: "bet", amount: 90 },
  { seat: 0, at: 4600, kind: "fold" },
  { seat: 1, at: 4850, kind: "bet", amount: 90 },
];
const COLLECT_1 = 5450;
const TAP_1 = 5900;
const FLOP_AT = 6300;
const FLOP_FLIP = 7150;
const FLOP_BETS: Action[] = [
  { seat: 3, at: 8300, kind: "bet", amount: 240 },
  { seat: 4, at: 8650, kind: "bet", amount: 240 },
  { seat: 6, at: 9000, kind: "fold" },
  { seat: 1, at: 9200, kind: "fold" },
];
const COLLECT_2 = 9600;
const TAP_2 = 9950;
const TURN_AT = 10350;
const TURN_FLIP = 10900;
const TAP_3 = 11750;
const RIVER_AT = 12150;
const RIVER_FLIP = 12950;
const PUSH_AT = 14400;
const WINNER = 4;
const SWEEP_AT = 17600;
const LOOP_MS = 18500;

const BURNS = [TAP_1, TAP_2, TAP_3];

interface Action {
  seat: number;
  at: number;
  kind: "fold" | "bet";
  amount?: number;
}

/** A Broadway straight, one of every suit, so the deck colours all show. */
const BOARD: Card[] = [
  { rank: 14, suit: "s" },
  { rank: 13, suit: "h" },
  { rank: 12, suit: "d" },
  { rank: 11, suit: "c" },
  { rank: 10, suit: "s" },
];

/** Seven seats around the far side; the dealer sits at the bottom. */
const SEATS = Array.from({ length: 7 }, (_, k) => {
  const angle = ((165 + (k * 210) / 6) * Math.PI) / 180;
  return { x: CENTER.x + 250 * Math.cos(angle), y: CENTER.y + 158 * Math.sin(angle), angle };
});

type Point = { x: number; y: number };

/** Where a seat's chips land when bet: a little way in from the cards. */
function betSpot(seat: number): Point {
  const s = SEATS[seat];
  return { x: s.x - Math.cos(s.angle) * 70, y: s.y - Math.sin(s.angle) * 56 };
}

function vars(entries: Record<string, Point>): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const [name, p] of Object.entries(entries)) {
    out[`--${name}x`] = `${p.x}px`;
    out[`--${name}y`] = `${p.y}px`;
  }
  return out as React.CSSProperties;
}

function delta(from: Point, to: Point): Point {
  return { x: from.x - to.x, y: from.y - to.y };
}

function at(x: number, y: number, size = CARD): React.CSSProperties {
  return { left: x - size.w / 2, top: y - size.h / 2, width: size.w, height: size.h };
}

const FELT_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

const SHADOW = "drop-shadow(0 6px 5px rgba(0,0,0,0.45))";
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.5, 0, 0.75, 0)";

/** The deck, shuffled once at the start of each hand. */
function Deck({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute" style={{ ...at(DECK.x, DECK.y), filter: SHADOW }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const left = i % 2 === 0;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={
              {
                translate: `0 ${-i * 1.2}px`,
                "--sx": `${left ? -30 : 30}px`,
                "--rot": `${left ? -9 : 9}deg`,
                // Riffle: split, hold, then cards fall back in alternating from each half.
                animation: reduced
                  ? undefined
                  : `riffle-card 1150ms ease-in-out ${i * 40}ms both${i >= 4 ? ", strip-cut 420ms ease-in-out 1250ms both" : ""}`,
              } as React.CSSProperties
            }
          >
            <PlayingCard faceDown size="sm" />
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({
  card,
  index,
  dealAt,
  flipAt,
  slow,
  reduced,
}: {
  card: Card;
  index: number;
  dealAt: number;
  flipAt: number;
  slow?: boolean;
  reduced: boolean;
}) {
  const pos = { x: boardX(index), y: BOARD_Y };
  const isFlop = index < 3;
  return (
    <div
      className="absolute"
      style={{
        ...at(pos.x, pos.y, BOARD_CARD),
        ...vars({ d: delta(DECK, pos), p: { x: boardX(0) - pos.x, y: 0 } }),
        transformStyle: "preserve-3d",
        filter: SHADOW,
        animation: reduced
          ? undefined
          : `${isFlop ? "flop-deal 850ms" : "dealer-slide 480ms"} ${EASE_OUT} ${dealAt}ms both, dealer-sweep 600ms ${EASE_IN} ${SWEEP_AT + index * 40}ms forwards`,
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          animation: reduced ? undefined : `dealer-flip ${slow ? 950 : 460}ms cubic-bezier(0.3, 0.7, 0.2, 1) ${flipAt}ms both`,
        }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <PlayingCard card={card} size="md" />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <PlayingCard faceDown size="md" />
        </div>
      </div>
    </div>
  );
}

/** Chips pushed in as a bet, collected to the pot, and finally pushed to the winner. */
function Bet({ seat, amount, betAt, collectAt, reduced }: { seat: number; amount: number; betAt: number; collectAt: number; reduced: boolean }) {
  if (reduced) return null;
  const spot = betSpot(seat);
  const from = SEATS[seat];
  const winner = betSpot(WINNER);
  // Spread the collected bets a little so the pot reads as a cluster, not one blob.
  const potSpot = { x: POT.x + (seat - 3) * 14, y: POT.y + (seat % 2) * 6 };
  return (
    <div
      className="absolute flex items-end justify-center"
      style={{
        left: spot.x - 36,
        top: spot.y - 48,
        width: 72,
        height: 48,
        ...vars({ d: delta(from, spot), c: delta(potSpot, spot), w: delta(winner, spot) }),
        animation: `dealer-slide 420ms ${EASE_OUT} ${betAt}ms both, bet-collect 520ms ${EASE_IN} ${collectAt}ms forwards, pot-push 650ms ${EASE_OUT} ${PUSH_AT}ms forwards, fade-out 400ms ease-in ${SWEEP_AT}ms forwards`,
      }}
    >
      <div className="flex items-end justify-center" style={{ transform: `rotateX(-${TILT}deg)`, transformOrigin: "50% 100%" }}>
        <div className="absolute bottom-[-6px] h-3 w-[56px] rounded-[50%] bg-black/50 blur-[3px]" />
        <ChipStack amount={amount} scale={2} maxStacks={2} />
      </div>
    </div>
  );
}

export function DealerScene() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [cycle, setCycle] = useState(0);

  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const byWidth = e.contentRect.width / (W + 40);
      // A collapsed height means the container isn't sized yet; fit to width alone.
      const byHeight = e.contentRect.height > 120 ? e.contentRect.height / (H * 0.82) : Infinity;
      setScale(Math.min(1.25, byWidth, byHeight));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const t0 = setTimeout(() => setReduced(mq.matches), 0);
    if (mq.matches) return () => clearTimeout(t0);
    // Restart the hand each loop; skip while the tab is hidden so it resumes mid-rest, not mid-deal.
    const t = setInterval(() => {
      if (!document.hidden) setCycle((c) => c + 1);
    }, LOOP_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const anim = (value: string) => (reduced ? undefined : value);
  const foldAt = (seat: number) => [...PREFLOP, ...FLOP_BETS].find((a) => a.seat === seat && a.kind === "fold")?.at;

  return (
    <div ref={wrapper} className="relative flex h-full w-full items-center" aria-hidden>
      {/* Spotlight */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-12%] h-[130%] w-[150%] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse 42% 38% at 50% 40%, rgba(255,232,190,0.16) 0%, rgba(255,232,190,0.05) 40%, transparent 70%)",
          animation: anim("spot-breathe 9s ease-in-out infinite"),
        }}
      />

      <div className="relative mx-auto" style={{ width: W * scale, height: H * 0.82 * scale, visibility: scale ? "visible" : "hidden" }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, scale: String(scale) }}>
          <div className="relative" style={{ width: W, height: H, perspective: 1200, perspectiveOrigin: "50% 8%" }}>
            <div
              key={cycle}
              className="absolute left-0 top-0"
              style={{ width: W, height: H, transform: `rotateX(${TILT}deg)`, transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
            >
              {/* Floor shadow */}
              <div className="absolute inset-[-6%_-3%_-10%] rounded-[50%] bg-black/70 blur-2xl" />

              {/* Walnut rim */}
              <div
                className="absolute inset-0 rounded-[50%]"
                style={{
                  background: "linear-gradient(180deg, #4A2E1C 0%, #2D1B10 45%, #1B100A 100%)",
                  boxShadow: "inset 0 3px 0 rgba(255,205,150,0.18), inset 0 -3px 0 rgba(0,0,0,0.6)",
                }}
              />
              {/* Leather rail */}
              <div
                className="absolute inset-[9px] rounded-[50%]"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, #34383F 0%, #1B1E22 60%, #0E1013 100%)",
                  boxShadow: "inset 0 4px 6px rgba(255,255,255,0.09), inset 0 -6px 12px rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.6)",
                }}
              />
              {/* Brass inlay */}
              <div className="absolute inset-[30px] rounded-[50%] border-[2px] border-[#C9A25A]/70" style={{ boxShadow: "0 0 10px rgba(229,185,106,0.25)" }} />
              {/* Felt */}
              <div
                className="absolute inset-[34px] overflow-hidden rounded-[50%]"
                style={{
                  background: "radial-gradient(ellipse at 50% 52%, #2E9A66 0%, #237A51 38%, #17603E 72%, #0E4229 100%)",
                  boxShadow: "inset 0 22px 60px rgba(0,0,0,0.45), inset 0 -10px 30px rgba(0,0,0,0.35)",
                }}
              >
                <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: FELT_NOISE }} />
                <div className="absolute inset-[26px] rounded-[50%] border border-[#E5B96A]/15" />
                <div className="absolute inset-x-0 text-center font-display text-[30px] font-semibold tracking-tight text-black/[0.14]" style={{ top: 246 }}>
                  holdemics
                </div>
              </div>

              {/* Dealer button by the last seat */}
              <div
                className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-[#F4F1EA] font-display text-[11px] font-bold text-[#1A1D21]"
                style={{ left: SEATS[6].x - 58, top: SEATS[6].y - 12, boxShadow: "0 2px 3px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(0,0,0,0.15)" }}
              >
                D
              </div>

              {/* Tap ripples */}
              {BURNS.map((t) => (
                <div
                  key={`tap-${t}`}
                  className="absolute rounded-full border-2 border-[#E5B96A]/80"
                  style={{ left: DEALER.x - 40, top: DEALER.y - 72, width: 80, height: 80, opacity: 0, animation: anim(`dealer-tap 700ms ease-out ${t}ms both`) }}
                />
              ))}

              <Deck reduced={reduced} />

              {/* Blinds, then the betting rounds */}
              <Bet seat={0} amount={15} betAt={BLINDS_AT} collectAt={COLLECT_1} reduced={reduced} />
              <Bet seat={1} amount={30} betAt={BLINDS_AT + 180} collectAt={COLLECT_1} reduced={reduced} />
              {PREFLOP.filter((a) => a.kind === "bet").map((a) => (
                <Bet key={`pre-${a.seat}`} seat={a.seat} amount={a.amount!} betAt={a.at} collectAt={COLLECT_1} reduced={reduced} />
              ))}
              {FLOP_BETS.filter((a) => a.kind === "bet").map((a) => (
                <Bet key={`flop-${a.seat}`} seat={a.seat} amount={a.amount!} betAt={a.at} collectAt={COLLECT_2} reduced={reduced} />
              ))}

              {/* Two cards pitched to every seat; folded hands slide to the muck */}
              {[0, 1].flatMap((round) =>
                SEATS.map((s, k) => {
                  const n = round * SEATS.length + k;
                  const along = round ? 10 : -10;
                  const pos = { x: s.x - Math.sin(s.angle) * along, y: s.y + Math.cos(s.angle) * along };
                  const rot = (s.angle * 180) / Math.PI + 90 + (round ? 7 : -7);
                  const fold = foldAt(k);
                  const after = fold
                    ? `fold-out 500ms ${EASE_IN} ${fold + round * 60}ms forwards`
                    : `dealer-sweep 600ms ${EASE_IN} ${SWEEP_AT + n * 25}ms forwards`;
                  return (
                    <div
                      key={`hole-${n}`}
                      className="absolute"
                      style={{
                        ...at(pos.x, pos.y),
                        ...vars({ d: delta(DECK, pos), m: delta(MUCK, pos) }),
                        filter: SHADOW,
                        animation: anim(`dealer-pitch 600ms cubic-bezier(0.12, 0.75, 0.2, 1) ${DEAL_START + n * DEAL_STAGGER}ms both, ${after}`),
                      }}
                    >
                      {/* Resting angle lives on an inner wrapper so the flight path isn't rotated with it. */}
                      <div style={{ rotate: `${rot}deg` }}>
                        <PlayingCard faceDown size="sm" />
                      </div>
                    </div>
                  );
                }),
              )}

              {/* Burn cards to the muck */}
              {BURNS.map((t, i) => {
                const pos = { x: MUCK.x + i * 4, y: MUCK.y - i * 2 };
                return (
                  <div
                    key={`burn-${i}`}
                    className="absolute"
                    style={{
                      ...at(pos.x, pos.y),
                      ...vars({ d: delta(DECK, pos) }),
                      filter: SHADOW,
                      animation: anim(`dealer-slide 440ms ${EASE_OUT} ${t + 240}ms both, dealer-sweep 600ms ${EASE_IN} ${SWEEP_AT + 200}ms forwards`),
                    }}
                  >
                    <div style={{ rotate: `${-16 + i * 8}deg` }}>
                      <PlayingCard faceDown size="sm" />
                    </div>
                  </div>
                );
              })}

              {/* Board */}
              {[0, 1, 2].map((i) => (
                <BoardCard key={`flop-${i}`} card={BOARD[i]} index={i} dealAt={FLOP_AT} flipAt={FLOP_FLIP + i * 140} reduced={reduced} />
              ))}
              <BoardCard card={BOARD[3]} index={3} dealAt={TURN_AT} flipAt={TURN_FLIP} reduced={reduced} />
              <BoardCard card={BOARD[4]} index={4} dealAt={RIVER_AT} flipAt={RIVER_FLIP} slow reduced={reduced} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
