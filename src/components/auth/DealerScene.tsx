"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChipStack } from "@/components/table/ChipStack";
import { PlayingCard } from "@/components/table/PlayingCard";
import type { Card } from "@/lib/engine/cards";

/**
 * The deal, seen from the dealer's chair, played once: the deck riffles,
 * two cards are pitched to each seat, the dealer taps the felt, burns, and
 * lays out the flop, turn, and river. Then the hand rests on the table.
 * Everything is CSS animation on a tilted plane under a spotlight.
 */

const W = 640;
const H = 420;
const TILT = 54;
const DEALER = { x: 320, y: 372 };
const DECK = { x: 268, y: 352 };
const MUCK = { x: 372, y: 352 };
const CARD = { w: 42, h: 59 };
const BOARD_CARD = { w: 56, h: 78 };
const BOARD_Y = 200;
const boardX = (i: number) => W / 2 + (i - 2) * 64;

// Timeline (ms).
const DEAL_START = 1400;
const DEAL_STAGGER = 85;
const TAPS = [3400, 5900, 7800];
const FLOP_AT = 3900;
const FLOP_FLIP = 4750;
const TURN_AT = 6350;
const TURN_FLIP = 6900;
const RIVER_AT = 8250;
const RIVER_FLIP = 9050;

/** A Broadway straight, one of every suit, so the deck colours all show. */
const BOARD: Card[] = [
  { rank: 14, suit: "s" },
  { rank: 13, suit: "h" },
  { rank: 12, suit: "d" },
  { rank: 11, suit: "c" },
  { rank: 10, suit: "s" },
];

const CHIPS = [740, 1180, 965, 1310, 520, 885, 1045];

/** Seven seats around the far side; the dealer sits at the bottom. */
const SEATS = Array.from({ length: 7 }, (_, k) => {
  const angle = ((165 + (k * 210) / 6) * Math.PI) / 180;
  return { x: W / 2 + 250 * Math.cos(angle), y: 210 + 158 * Math.sin(angle), angle };
});

function offset(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { "--dx": `${from.x - to.x}px`, "--dy": `${from.y - to.y}px` } as React.CSSProperties;
}

function at(x: number, y: number, size = CARD): React.CSSProperties {
  return { left: x - size.w / 2, top: y - size.h / 2, width: size.w, height: size.h };
}

const FELT_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

const SHADOW = "drop-shadow(0 6px 5px rgba(0,0,0,0.45))";

/** A board card that lands face down and turns over. */
function BoardCard({
  card,
  x,
  y,
  flipDelay,
  slow,
  style,
  reduced,
}: {
  card: Card;
  x: number;
  y: number;
  flipDelay: number;
  slow?: boolean;
  style: React.CSSProperties;
  reduced: boolean;
}) {
  return (
    <div className="absolute" style={{ ...at(x, y, BOARD_CARD), ...style, transformStyle: "preserve-3d", filter: SHADOW }}>
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          animation: reduced ? undefined : `dealer-flip ${slow ? 950 : 460}ms cubic-bezier(0.3, 0.7, 0.2, 1) ${flipDelay}ms both`,
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

export function DealerScene() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [reduced, setReduced] = useState(false);

  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    // Fit the projected table to both the width and the height on offer.
    const ro = new ResizeObserver(([e]) =>
      setScale(Math.min(1.25, e.contentRect.width / (W + 40), e.contentRect.height / (H * 0.82))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), 0);
    return () => clearTimeout(t);
  }, []);

  const anim = (value: string) => (reduced ? undefined : value);

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

              {/* Chip stacks stand upright in front of each seat */}
              {SEATS.map((s, k) => {
                const cx = s.x - Math.cos(s.angle) * 46;
                const cy = s.y - Math.sin(s.angle) * 40;
                return (
                  <div
                    key={`chips-${k}`}
                    className="absolute flex items-end justify-center"
                    style={{ left: cx - 36, top: cy - 48, width: 72, height: 48, transform: `rotateX(-${TILT}deg)`, transformOrigin: "50% 100%" }}
                  >
                    <div className="absolute bottom-[-6px] h-3 w-[60px] rounded-[50%] bg-black/50 blur-[3px]" />
                    <ChipStack amount={CHIPS[k]} scale={1.2} maxStacks={3} />
                  </div>
                );
              })}

              {/* Dealer button by the last seat */}
              <div
                className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-[#F4F1EA] font-display text-[11px] font-bold text-[#1A1D21]"
                style={{ left: SEATS[6].x - 58, top: SEATS[6].y - 12, boxShadow: "0 2px 3px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(0,0,0,0.15)" }}
              >
                D
              </div>

              {/* Tap ripples */}
              {TAPS.map((t) => (
                <div
                  key={`tap-${t}`}
                  className="absolute rounded-full border-2 border-[#E5B96A]/80"
                  style={{ left: DEALER.x - 40, top: DEALER.y - 72, width: 80, height: 80, opacity: 0, animation: anim(`dealer-tap 700ms ease-out ${t}ms both`) }}
                />
              ))}

              {/* Deck: riffles once, then sits by the dealer */}
              <div className="absolute" style={{ ...at(DECK.x, DECK.y), filter: SHADOW }}>
                {[0, 1].map((half) => (
                  <div key={half} className="absolute inset-0" style={{ animation: anim(`${half ? "riffle-right" : "riffle-left"} 1100ms ease-in-out 150ms both`) }}>
                    {[0, 1, 2, 3].map((d) => (
                      <div key={d} className="absolute inset-0" style={{ translate: `0 ${-d * 1.4}px` }}>
                        <PlayingCard faceDown size="sm" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Two cards pitched to every seat */}
              {[0, 1].flatMap((round) =>
                SEATS.map((s, k) => {
                  const n = round * SEATS.length + k;
                  const along = round ? 10 : -10;
                  const pos = { x: s.x - Math.sin(s.angle) * along, y: s.y + Math.cos(s.angle) * along };
                  const rot = (s.angle * 180) / Math.PI + 90 + (round ? 7 : -7);
                  return (
                    <div
                      key={`hole-${n}`}
                      className="absolute"
                      style={{
                        ...at(pos.x, pos.y),
                        ...offset(DECK, pos),
                        filter: SHADOW,
                        animation: anim(`dealer-pitch 600ms cubic-bezier(0.12, 0.75, 0.2, 1) ${DEAL_START + n * DEAL_STAGGER}ms both`),
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
              {TAPS.map((t, i) => {
                const pos = { x: MUCK.x + i * 4, y: MUCK.y - i * 2 };
                return (
                  <div
                    key={`burn-${i}`}
                    className="absolute"
                    style={{ ...at(pos.x, pos.y), ...offset(DECK, pos), filter: SHADOW, animation: anim(`dealer-slide 440ms cubic-bezier(0.2, 0.8, 0.3, 1) ${t + 240}ms both`) }}
                  >
                    <div style={{ rotate: `${-16 + i * 8}deg` }}>
                      <PlayingCard faceDown size="sm" />
                    </div>
                  </div>
                );
              })}

              {/* Flop: slid out as a stack, spread, then turned in a wave */}
              {[0, 1, 2].map((i) => (
                <BoardCard
                  key={`flop-${i}`}
                  card={BOARD[i]}
                  x={boardX(i)}
                  y={BOARD_Y}
                  flipDelay={FLOP_FLIP + i * 140}
                  reduced={reduced}
                  style={
                    {
                      ...offset(DECK, { x: boardX(i), y: BOARD_Y }),
                      "--px": `${boardX(0) - boardX(i)}px`,
                      animation: anim(`flop-deal 850ms cubic-bezier(0.25, 0.8, 0.3, 1) ${FLOP_AT}ms both`),
                    } as React.CSSProperties
                  }
                />
              ))}
              <BoardCard
                card={BOARD[3]}
                x={boardX(3)}
                y={BOARD_Y}
                flipDelay={TURN_FLIP}
                reduced={reduced}
                style={{ ...offset(DECK, { x: boardX(3), y: BOARD_Y }), animation: anim(`dealer-slide 480ms cubic-bezier(0.2, 0.8, 0.3, 1) ${TURN_AT}ms both`) }}
              />
              <BoardCard
                card={BOARD[4]}
                x={boardX(4)}
                y={BOARD_Y}
                slow
                flipDelay={RIVER_FLIP}
                reduced={reduced}
                style={{ ...offset(DECK, { x: boardX(4), y: BOARD_Y }), animation: anim(`dealer-slide 480ms cubic-bezier(0.2, 0.8, 0.3, 1) ${RIVER_AT}ms both`) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
