"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/engine/cards";
import { DRAMATIC_FLIP_MS } from "@/lib/practice/runout";
import { FLIP_MS } from "@/lib/practice/timing";
import { type CardSize, PlayingCard } from "./PlayingCard";

const DIMENSIONS: Record<CardSize, { w: number; h: number }> = {
  xs: { w: 28, h: 39 },
  sm: { w: 42, h: 59 },
  md: { w: 56, h: 78 },
  lg: { w: 66, h: 92 },
};

interface FlipCardProps {
  card: Card;
  size: CardSize;
  /** Epoch ms when the card turns face up; otherwise it flips `flipDelay` ms after mounting. */
  flipAt?: number;
  flipDelay?: number;
  dealDelay?: number;
  dealFrom?: { dx: number; dy: number };
  /** Lift the card and turn it slowly — used for the river on a runout. */
  dramatic?: boolean;
}

type Phase = "down" | "lifted" | "up";

/** A card that lands face down and turns over, like a dealer turning the board. */
export function FlipCard({ card, size, flipAt, flipDelay = 250, dealDelay, dealFrom, dramatic = false }: FlipCardProps) {
  const [phase, setPhase] = useState<Phase>("down");
  useEffect(() => {
    const wait = Math.max(0, flipAt !== undefined ? flipAt - Date.now() : flipDelay);
    const timers = [setTimeout(() => setPhase("up"), wait)];
    if (dramatic) timers.push(setTimeout(() => setPhase("lifted"), Math.max(0, wait - 450)));
    return () => timers.forEach(clearTimeout);
  }, [flipAt, flipDelay, dramatic]);

  const { w, h } = DIMENSIONS[size];
  const fly: React.CSSProperties = dealFrom
    ? ({
        animation: `deal-fly 420ms ${dealDelay ?? 0}ms both cubic-bezier(0.2, 0.8, 0.25, 1)`,
        "--dx": `${dealFrom.dx}px`,
        "--dy": `${dealFrom.dy}px`,
      } as React.CSSProperties)
    : {};
  const lifted = dramatic && phase !== "down";
  const flipMs = dramatic ? DRAMATIC_FLIP_MS : FLIP_MS;

  return (
    <div style={{ width: w, height: h, ...fly }}>
      <div
        style={{
          width: w,
          height: h,
          perspective: 700,
          translate: lifted && phase === "lifted" ? "0 -10px" : "0 0",
          scale: lifted && phase === "lifted" ? "1.1" : "1",
          transition: "translate 350ms ease-out, scale 350ms ease-out",
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: phase === "up" ? "rotateY(0deg)" : "rotateY(180deg)",
            transition: `transform ${flipMs}ms cubic-bezier(0.3, 0.7, 0.2, 1)`,
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            <PlayingCard card={card} size={size} />
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <PlayingCard faceDown size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}
