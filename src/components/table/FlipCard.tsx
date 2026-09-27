"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/engine/cards";
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
}

/** A card that lands face down and turns over at `flipAt`, like a dealer burning and turning. */
export function FlipCard({ card, size, flipAt, flipDelay = 250, dealDelay, dealFrom }: FlipCardProps) {
  const [faceUp, setFaceUp] = useState(false);
  useEffect(() => {
    const wait = flipAt !== undefined ? flipAt - Date.now() : flipDelay;
    const t = setTimeout(() => setFaceUp(true), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [flipAt, flipDelay]);

  const { w, h } = DIMENSIONS[size];
  const fly: React.CSSProperties = dealFrom
    ? ({
        animation: `deal-fly 420ms ${dealDelay ?? 0}ms both cubic-bezier(0.2, 0.8, 0.25, 1)`,
        "--dx": `${dealFrom.dx}px`,
        "--dy": `${dealFrom.dy}px`,
      } as React.CSSProperties)
    : {};

  return (
    <div style={{ width: w, height: h, perspective: 700, ...fly }}>
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)",
          transition: "transform 460ms cubic-bezier(0.3, 0.7, 0.2, 1)",
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
  );
}
