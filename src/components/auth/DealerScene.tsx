"use client";

import { useEffect, useMemo, useState } from "react";
import { ChipStack } from "@/components/table/ChipStack";
import { PlayingCard } from "@/components/table/PlayingCard";
import { type Card, createRng, freshDeck, shuffle } from "@/lib/engine/cards";

/**
 * The deal, seen from the dealer's chair: shuffle, pitch two cards to every
 * seat, tap the felt, burn, spread the flop and turn it, then the turn and a
 * slow river. Everything is collected and it starts again. Pure CSS
 * animations on a tilted felt plane, restarted each loop by re-keying.
 */

const W = 600;
const H = 400;
const TILT = 52;
const DEALER = { x: 300, y: 350 };
const MUCK = { x: 404, y: 300 };
const CARD = { w: 42, h: 59 };

// Timeline (ms).
const DEAL_START = 1300;
const DEAL_STAGGER = 80;
const TAPS = [3200, 5500, 7300];
const FLOP_AT = 3650;
const FLOP_FLIP = 4450;
const TURN_AT = 5950;
const TURN_FLIP = 6450;
const RIVER_AT = 7750;
const RIVER_FLIP = 8500;
const SWEEP_AT = 10800;
const LOOP_MS = 11900;

const SEATS = Array.from({ length: 8 }, (_, k) => {
  const angle = ((160 + (k * 220) / 7) * Math.PI) / 180;
  return { x: W / 2 + 228 * Math.cos(angle), y: 196 + 150 * Math.sin(angle), angle };
});
const BOARD_Y = 188;
const boardX = (i: number) => W / 2 + (i - 2) * 56;

function offset(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { "--dx": `${from.x - to.x}px`, "--dy": `${from.y - to.y}px` } as React.CSSProperties;
}

function at(x: number, y: number): React.CSSProperties {
  return { left: x - CARD.w / 2, top: y - CARD.h / 2, width: CARD.w, height: CARD.h };
}

/** A card lying on the felt that can turn face up. */
function BoardCard({ card, x, y, style, flipDelay, slow }: { card: Card; x: number; y: number; style: React.CSSProperties; flipDelay: number; slow?: boolean }) {
  return (
    <div className="absolute" style={{ ...at(x, y), ...style, transformStyle: "preserve-3d" }}>
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          animation: `dealer-flip ${slow ? 900 : 450}ms cubic-bezier(0.3, 0.7, 0.2, 1) ${flipDelay}ms both`,
        }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <PlayingCard card={card} size="sm" />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <PlayingCard faceDown size="sm" />
        </div>
      </div>
    </div>
  );
}

export function DealerScene() {
  const [cycle, setCycle] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const t0 = setTimeout(() => setReduced(mq.matches), 0);
    if (mq.matches) return () => clearTimeout(t0);
    const t = setInterval(() => {
      if (!document.hidden) setCycle((c) => c + 1);
    }, LOOP_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const board = useMemo(() => shuffle(freshDeck(), createRng(9173 + cycle * 31)).slice(0, 5), [cycle]);
  const sweep = (delay = 0) => (reduced ? "" : `, dealer-sweep 600ms cubic-bezier(0.5, 0, 0.75, 0) ${SWEEP_AT + delay}ms forwards`);

  return (
    <div className="relative flex w-full flex-col items-center" aria-hidden>
      <div className="relative" style={{ width: W, height: H * 0.78, perspective: 1100, perspectiveOrigin: "50% 10%" }}>
        <div
          key={cycle}
          className="absolute left-0 top-0"
          style={{ width: W, height: H, transform: `rotateX(${TILT}deg)`, transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
        >
          {/* Rail and felt */}
          <div
            className="absolute inset-0 rounded-[50%]"
            style={{
              background: "linear-gradient(180deg, #2B2F35, #121417)",
              boxShadow: "0 60px 90px -30px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.07)",
            }}
          />
          <div
            className="absolute inset-[18px] rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at 50% 60%, #2C9463 0%, #1F6F4A 42%, #155637 78%, #0E3D27 100%)",
              boxShadow: "inset 0 0 0 1px rgba(229,185,106,0.35), inset 0 20px 60px rgba(0,0,0,0.4)",
            }}
          />
          <div className="absolute inset-[64px] rounded-[50%] border border-[#E5B96A]/20" />
          <div
            className="absolute font-display text-[26px] font-semibold tracking-tight text-white/[0.07]"
            style={{ left: 0, right: 0, top: 262, textAlign: "center" }}
          >
            holdemics
          </div>

          {/* Chip stacks stand upright at each seat */}
          {SEATS.map((s, k) => (
            <div
              key={`chips-${k}`}
              className="absolute"
              style={{
                left: s.x + Math.cos(s.angle) * 30 - 30,
                top: s.y + Math.sin(s.angle) * 26 - 44,
                width: 60,
                height: 44,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                transform: `rotateX(-${TILT}deg)`,
                transformOrigin: "50% 100%",
              }}
            >
              <ChipStack amount={[740, 1180, 965, 1310, 520, 885, 1045, 690][k]} scale={1.15} maxStacks={3} />
            </div>
          ))}

          {/* Tap ripples */}
          {!reduced &&
            TAPS.map((t) => (
              <div
                key={`tap-${t}`}
                className="absolute rounded-full border-2 border-[#E5B96A]/70"
                // Invisible at rest, so nothing lingers if animations don't run.
                style={{ left: DEALER.x - 40, top: DEALER.y - 58, width: 80, height: 80, opacity: 0, animation: `dealer-tap 700ms ease-out ${t}ms both` }}
              />
            ))}

          {/* The deck: riffles, then bumps on each tap */}
          <div className="absolute" style={{ ...at(DEALER.x, DEALER.y - 18) }}>
            {[0, 1].map((half) => (
              <div
                key={half}
                className="absolute inset-0"
                style={{ animation: reduced ? undefined : `${half ? "riffle-right" : "riffle-left"} 1100ms ease-in-out 100ms both` }}
              >
                {[0, 1, 2].map((d) => (
                  <div key={d} className="absolute inset-0" style={{ translate: `0 ${-d * 1.5}px` }}>
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
              const along = round ? 9 : -9;
              const pos = { x: s.x - Math.sin(s.angle) * along - Math.cos(s.angle) * 18, y: s.y + Math.cos(s.angle) * along - Math.sin(s.angle) * 12 };
              const rot = (s.angle * 180) / Math.PI + 90 + (round ? 8 : -8);
              return (
                <div
                  key={`hole-${n}`}
                  className="absolute"
                  style={{
                    ...at(pos.x, pos.y),
                    ...offset(DEALER, pos),
                    animation: reduced ? undefined : `dealer-pitch 560ms cubic-bezier(0.12, 0.75, 0.2, 1) ${DEAL_START + n * DEAL_STAGGER}ms both${sweep(n * 12)}`,
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

          {/* Burn cards */}
          {[TAPS[0], TAPS[1], TAPS[2]].map((t, i) => (
            <div
              key={`burn-${i}`}
              className="absolute"
              style={{
                ...at(MUCK.x + i * 3, MUCK.y - i * 2),
                ...offset(DEALER, { x: MUCK.x + i * 3, y: MUCK.y - i * 2 }),
                animation: reduced ? undefined : `dealer-slide 420ms cubic-bezier(0.2, 0.8, 0.3, 1) ${t + 220}ms both${sweep()}`,
              }}
            >
              <div style={{ rotate: `${-18 + i * 7}deg` }}>
                <PlayingCard faceDown size="sm" />
              </div>
            </div>
          ))}

          {/* Flop: slid out as a stack, spread, then turned in a wave */}
          {[0, 1, 2].map((i) => (
            <BoardCard
              key={`flop-${i}`}
              card={board[i]}
              x={boardX(i)}
              y={BOARD_Y}
              flipDelay={reduced ? 0 : FLOP_FLIP + i * 130}
              style={{
                ...offset(DEALER, { x: boardX(i), y: BOARD_Y }),
                "--px": `${boardX(0) - boardX(i)}px`,
                animation: reduced ? undefined : `flop-deal 800ms cubic-bezier(0.25, 0.8, 0.3, 1) ${FLOP_AT}ms both${sweep(i * 30)}`,
              } as React.CSSProperties}
            />
          ))}
          <BoardCard
            card={board[3]}
            x={boardX(3)}
            y={BOARD_Y}
            flipDelay={reduced ? 0 : TURN_FLIP}
            style={{
              ...offset(DEALER, { x: boardX(3), y: BOARD_Y }),
              animation: reduced ? undefined : `dealer-slide 460ms cubic-bezier(0.2, 0.8, 0.3, 1) ${TURN_AT}ms both${sweep(90)}`,
            }}
          />
          <BoardCard
            card={board[4]}
            x={boardX(4)}
            y={BOARD_Y}
            slow
            flipDelay={reduced ? 0 : RIVER_FLIP}
            style={{
              ...offset(DEALER, { x: boardX(4), y: BOARD_Y }),
              animation: reduced ? undefined : `dealer-slide 460ms cubic-bezier(0.2, 0.8, 0.3, 1) ${RIVER_AT}ms both${sweep(120)}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
