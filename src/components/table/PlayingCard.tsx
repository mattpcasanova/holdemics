"use client";

import { useId } from "react";
import { type Card, type Suit, rankLabel } from "@/lib/engine/cards";
import { type CardBackSkin, CARD_BACKS } from "@/lib/cosmetics";
import { type DeckStyle, useSettings } from "@/lib/settings";

export type CardSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<CardSize, { w: number; h: number; radius: number }> = {
  xs: { w: 28, h: 39, radius: 4 },
  sm: { w: 42, h: 59, radius: 5 },
  md: { w: 56, h: 78, radius: 6 },
  lg: { w: 66, h: 92, radius: 7 },
};

const SUIT_GLYPH: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const SUIT_NAME: Record<Suit, string> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };

const FOUR_COLOR: Record<Suit, string> = { s: "#1A1D21", h: "#C8323A", d: "#2166C4", c: "#1E8A4C" };
const TWO_COLOR: Record<Suit, string> = { s: "#1A1D21", h: "#C8323A", d: "#C8323A", c: "#1A1D21" };
const FULL_BG: Record<Suit, string> = { s: "#262A31", h: "#C23B3B", d: "#2A67C9", c: "#23804A" };

export function cardColors(suit: Suit, style: DeckStyle) {
  if (style === "full-color") return { bg: FULL_BG[suit], ink: "#FFFFFF", pip: "rgba(255,255,255,0.92)" };
  const ink = (style === "four-color" ? FOUR_COLOR : TWO_COLOR)[suit];
  return { bg: "#F7F5F0", ink, pip: ink };
}

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: CardSize;
  dimmed?: boolean;
  highlight?: boolean;
  dealDelay?: number;
  /** Override the player's chosen skin/style (used by settings previews). */
  backSkin?: string;
  deckStyle?: DeckStyle;
  /** Pixel offset of the dealer from this card; the card flies in from there. */
  dealFrom?: { dx: number; dy: number };
}

export function PlayingCard({
  card,
  faceDown = false,
  size = "sm",
  dimmed = false,
  highlight = false,
  dealDelay,
  backSkin,
  deckStyle,
  dealFrom,
}: PlayingCardProps) {
  const settings = useSettings();
  const s = SIZES[size];
  const anim: React.CSSProperties = dealFrom
    ? ({
        animation: `deal-fly 480ms ${dealDelay ?? 0}ms both cubic-bezier(0.2, 0.8, 0.25, 1)`,
        "--dx": `${dealFrom.dx}px`,
        "--dy": `${dealFrom.dy}px`,
      } as React.CSSProperties)
    : dealDelay !== undefined
      ? { animation: `deal-in 300ms ${dealDelay}ms both cubic-bezier(0.2, 0.8, 0.25, 1)` }
      : {};

  if (faceDown || !card) {
    const skin = CARD_BACKS[backSkin ?? settings.cardBack] ?? CARD_BACKS.classic;
    return (
      <div
        aria-label="face-down card"
        className="shrink-0"
        style={{
          width: s.w,
          height: s.h,
          opacity: dimmed ? 0.35 : 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          ...anim,
        }}
      >
        <CardBack skin={skin} radius={s.radius} detailed={size !== "xs"} />
      </div>
    );
  }

  const { bg, ink, pip } = cardColors(card.suit, deckStyle ?? settings.deckStyle);
  const glyph = SUIT_GLYPH[card.suit];
  const label = rankLabel(card.rank);
  return (
    <div
      role="img"
      aria-label={`${label} of ${SUIT_NAME[card.suit]}`}
      className="relative shrink-0 select-none overflow-hidden font-display"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: bg,
        color: ink,
        opacity: dimmed ? 0.45 : 1,
        boxShadow: highlight
          ? "0 0 0 2px var(--gold), 0 6px 18px rgba(229,185,106,0.35)"
          : "0 2px 6px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.08)",
        transform: highlight ? "translateY(-4px)" : undefined,
        transition: "transform 200ms, box-shadow 200ms",
        ...anim,
      }}
    >
      {/* Corner index */}
      <div
        className="absolute flex flex-col items-center leading-none"
        style={{ top: s.h * 0.06, left: s.w * 0.08, width: s.w * 0.36 }}
      >
        <span className="font-bold tracking-[-0.04em]" style={{ fontSize: s.h * (label === "10" ? 0.25 : 0.29) }}>
          {label}
        </span>
        <span style={{ fontSize: s.h * 0.2, marginTop: s.h * 0.01 }}>{glyph}</span>
      </div>
      {/* Large suit pip */}
      <span
        aria-hidden
        className="absolute leading-none"
        style={{ right: s.w * 0.06, bottom: s.h * 0.02, fontSize: s.h * 0.52, color: pip }}
      >
        {glyph}
      </span>
    </div>
  );
}

export function CardBack({ skin, radius = 6, detailed = true }: { skin: CardBackSkin; radius?: number; detailed?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const pid = `p-${uid}`;
  const cid = `c-${uid}`;
  const r = (radius / 56) * 100;

  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" aria-hidden className="block">
      <defs>
        <clipPath id={cid}>
          <rect x="9" y="9" width="82" height="122" rx={Math.max(2, r - 5)} />
        </clipPath>
        <Pattern id={pid} skin={skin} />
      </defs>
      <rect x="0" y="0" width="100" height="140" rx={r} fill={skin.base} />
      <rect x="3" y="3" width="94" height="134" rx={r - 1.5} fill="none" stroke={skin.frame} strokeWidth="2.5" />
      <g clipPath={`url(#${cid})`}>
        <rect x="0" y="0" width="100" height="140" fill={`url(#${pid})`} />
        {skin.pattern === "sunburst" &&
          Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <line
                key={i}
                x1="50"
                y1="70"
                x2={50 + Math.cos(a) * 120}
                y2={70 + Math.sin(a) * 120}
                stroke={skin.patternColor}
                strokeWidth={i % 2 ? 1 : 2.4}
              />
            );
          })}
      </g>
      <rect x="9" y="9" width="82" height="122" rx={Math.max(2, r - 5)} fill="none" stroke={skin.frame} strokeOpacity="0.55" strokeWidth="1" />
      {detailed && (
        <g>
          <circle cx="50" cy="70" r="21" fill={skin.emblemBg} stroke={skin.frame} strokeWidth="2" />
          <circle cx="50" cy="70" r="16.5" fill="none" stroke={skin.frame} strokeOpacity="0.5" strokeWidth="0.8" />
          <Emblem skin={skin} />
        </g>
      )}
    </svg>
  );
}

function Pattern({ id, skin }: { id: string; skin: CardBackSkin }) {
  const c = skin.patternColor;
  switch (skin.pattern) {
    case "lattice":
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H12M0 0V12" stroke={c} strokeWidth="1.4" fill="none" />
          <circle cx="6" cy="6" r="1.2" fill={c} />
        </pattern>
      );
    case "dots":
      return (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.6" fill={c} />
          <circle cx="0" cy="0" r="0.8" fill={c} />
          <circle cx="9" cy="9" r="0.8" fill={c} />
        </pattern>
      );
    case "chevron":
      return (
        <pattern id={id} width="14" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 8 L7 2 L14 8" stroke={c} strokeWidth="1.6" fill="none" />
        </pattern>
      );
    case "sunburst":
      return <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" />;
  }
}

function Emblem({ skin }: { skin: CardBackSkin }) {
  const glyph = { spade: "♠", star: "★", crown: "♛", monogram: "H" }[skin.emblem];
  return (
    <text
      x="50"
      y={skin.emblem === "monogram" ? 78.5 : 80}
      textAnchor="middle"
      fontSize={skin.emblem === "monogram" ? 24 : 27}
      fontWeight={700}
      fill={skin.emblemFg}
      fontFamily="var(--font-bricolage), serif"
    >
      {glyph}
    </text>
  );
}
