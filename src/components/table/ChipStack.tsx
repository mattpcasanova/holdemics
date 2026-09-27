"use client";

import { useId } from "react";
import { type ChipFace, CHIP_DENOMS_HP, CHIP_SETS } from "@/lib/cosmetics";
import { UNITS_PER_HP } from "@/lib/engine/modes";
import { useSettings } from "@/lib/settings";

function breakdown(units: number): number[] {
  const counts = CHIP_DENOMS_HP.map(() => 0);
  let remaining = units;
  for (let i = CHIP_DENOMS_HP.length - 1; i >= 0; i--) {
    const d = CHIP_DENOMS_HP[i] * UNITS_PER_HP;
    counts[i] = Math.floor(remaining / d);
    remaining -= counts[i] * d;
  }
  return counts;
}

/** Darken (negative) or lighten (positive) a #rrggbb color. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

interface ChipStackProps {
  amount: number;
  scale?: number;
  /** Override the player's chosen chip set (settings previews). */
  skin?: string;
  maxStacks?: number;
  /** "row" lines stacks up side by side; "pile" staggers them into two rows like a real pot. */
  layout?: "row" | "pile";
}

const MAX_PER_STACK = 10;

/** Side-on chip stacks, highest denomination first. */
export function ChipStack({ amount, scale = 1, skin, maxStacks = 3, layout = "row" }: ChipStackProps) {
  const settings = useSettings();
  const uid = useId().replace(/:/g, "");
  const set = CHIP_SETS[skin ?? settings.chips] ?? CHIP_SETS.classic;

  // Split big denominations into several columns so large pots look large.
  const stacks: { count: number; face: ChipFace }[] = [];
  breakdown(amount)
    .map((count, i) => ({ count, face: set.faces[i] }))
    .reverse()
    .forEach(({ count, face }) => {
      for (let left = count; left > 0; left -= MAX_PER_STACK) stacks.push({ count: Math.min(left, MAX_PER_STACK), face });
    });
  const shown = stacks.slice(0, maxStacks);
  if (!shown.length) return null;

  const rx = 11 * scale;
  const ry = 4 * scale;
  const thick = 3 * scale;
  const gap = 2 * scale;
  const tallest = Math.max(...shown.map((s) => s.count)) * thick;

  const pile = layout === "pile" && shown.length > 2;
  const front = pile ? shown.filter((_, i) => i % 2 === 0) : shown;
  const back = pile ? shown.filter((_, i) => i % 2 === 1) : [];
  const cols = Math.max(front.length, back.length + (pile ? 0.5 : 0));
  const width = cols * (rx * 2 + gap) + 2;
  const backLift = pile ? ry * 1.7 : 0;
  const height = tallest + ry * 2 + backLift + 4;

  const place = (list: typeof shown, row: "front" | "back") =>
    list.map((s, k) => ({
      ...s,
      cx: (row === "back" ? rx + gap / 2 : 0) + k * (rx * 2 + gap) + rx + 1,
      base: height - ry - 2 - (row === "back" ? backLift : 0),
    }));
  const columns = [...place(back, "back"), ...place(front, "front")];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <radialGradient id={`shine-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {columns.map((s, si) => (
        <g key={si}>
          <ellipse cx={s.cx} cy={s.base + thick * 0.6} rx={rx * 1.12} ry={ry * 1.1} fill="rgba(0,0,0,0.35)" />
          {Array.from({ length: s.count }).map((_, ci) => (
            <Chip
              key={ci}
              cx={s.cx}
              cy={s.base - ci * thick}
              rx={rx}
              ry={ry}
              thick={thick}
              face={s.face}
              top={ci === s.count - 1}
              shine={`shine-${uid}`}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Chip({
  cx,
  cy,
  rx,
  ry,
  thick,
  face,
  top,
  shine,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  thick: number;
  face: ChipFace;
  top: boolean;
  shine: string;
}) {
  const side = shade(face.base, -0.3);
  // Rim inserts seen on the chip's edge, spaced like they wrap around the curve.
  const inserts = [-0.78, -0.3, 0.2, 0.66];
  return (
    <g>
      <path d={`M${cx - rx} ${cy} v${thick} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v${-thick} Z`} fill={side} />
      {inserts.map((f, i) => {
        // The band's top edge at horizontal offset f follows the ellipse; spots narrow toward the sides.
        const curve = Math.sqrt(1 - f * f);
        return (
          <rect key={i} x={cx + f * rx} y={cy + ry * curve} width={rx * 0.22 * curve} height={thick} fill={face.stripe} />
        );
      })}
      <path
        d={`M${cx - rx} ${cy} v${thick} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v${-thick}`}
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={0.6}
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={face.base} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6} />
      {top && (
        <>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 0.86}
            ry={ry * 0.86}
            fill="none"
            stroke={face.stripe}
            strokeWidth={ry * 0.46}
            strokeDasharray={`${rx * 0.5} ${rx * 0.36}`}
          />
          <ellipse cx={cx} cy={cy} rx={rx * 0.52} ry={ry * 0.52} fill={face.inlay} stroke={shade(face.base, -0.2)} strokeWidth={0.6} />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${shine})`} />
        </>
      )}
    </g>
  );
}

/** A single chip seen from above, used in pickers and badges. */
export function ChipIcon({ face, size = 28 }: { face: ChipFace; size?: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <radialGradient id={`icon-shine-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.15" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={face.base} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={face.stripe} strokeWidth="5.5" strokeDasharray="7 5.2" />
      <circle cx="20" cy="20" r="10" fill={face.inlay} stroke={shade(face.base, -0.2)} strokeWidth="1" />
      <circle cx="20" cy="20" r="7.5" fill="none" stroke={shade(face.base, -0.1)} strokeOpacity="0.6" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
      <circle cx="20" cy="20" r="19" fill={`url(#icon-shine-${uid})`} />
    </svg>
  );
}
