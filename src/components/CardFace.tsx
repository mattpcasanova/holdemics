import type { Card } from "@/lib/types";

interface CardFaceProps {
  card: Card;
  size?: "sm" | "md";
}

const SUIT_SYMBOLS = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

function isRedSuit(suit: Card["suit"]) {
  return suit === "hearts" || suit === "diamonds";
}

const SIZES = {
  sm: { w: 36, h: 50, rank: 14, suit: 12 },
  md: { w: 44, h: 62, rank: 18, suit: 14 },
};

export function CardFace({ card, size = "sm" }: CardFaceProps) {
  const s = SIZES[size];
  const color = isRedSuit(card.suit) ? "var(--red)" : "var(--surface-primary)";

  return (
    <div
      className="bg-white rounded flex flex-col items-center justify-center font-display"
      style={{
        width: s.w,
        height: s.h,
        boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="font-medium leading-none"
        style={{ fontSize: s.rank, color }}
      >
        {card.rank}
      </div>
      <div className="leading-none" style={{ fontSize: s.suit, color }}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </div>
  );
}
