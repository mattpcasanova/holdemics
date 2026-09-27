"use client";

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

interface ChipStackProps {
  amount: number;
  scale?: number;
  /** Override the player's chosen chip set (settings previews). */
  skin?: string;
  maxStacks?: number;
}

/** Side-on chip stacks, one column per denomination (highest on the left). */
export function ChipStack({ amount, scale = 1, skin, maxStacks = 3 }: ChipStackProps) {
  const settings = useSettings();
  const set = CHIP_SETS[skin ?? settings.chips] ?? CHIP_SETS.classic;
  const stacks = breakdown(amount)
    .map((count, i) => ({ count: Math.min(count, 10), face: set.faces[i] }))
    .filter((s) => s.count > 0)
    .reverse()
    .slice(0, maxStacks);
  if (!stacks.length) return null;

  const rx = 10 * scale;
  const ry = 3.6 * scale;
  const thick = 2.8 * scale;
  const gap = 2 * scale;
  const width = stacks.length * (rx * 2 + gap);
  const height = Math.max(...stacks.map((s) => s.count)) * thick + ry * 2 + 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      {stacks.map((s, si) => {
        const cx = si * (rx * 2 + gap) + rx;
        const base = height - ry - 1;
        return (
          <g key={si}>
            <ellipse cx={cx} cy={base + thick} rx={rx * 1.05} ry={ry} fill="rgba(0,0,0,0.35)" />
            {Array.from({ length: s.count }).map((_, ci) => (
              <Chip key={ci} cx={cx} cy={base - ci * thick} rx={rx} ry={ry} thick={thick} face={s.face} top={ci === s.count - 1} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Chip({ cx, cy, rx, ry, thick, face, top }: { cx: number; cy: number; rx: number; ry: number; thick: number; face: ChipFace; top: boolean }) {
  // Edge band with the rim inserts visible on the side.
  const inserts = [-0.72, -0.12, 0.48].map((f) => cx + f * rx);
  return (
    <g>
      <path
        d={`M${cx - rx} ${cy} v${thick} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v${-thick} Z`}
        fill={face.base}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.5}
      />
      {inserts.map((x, i) => (
        <rect key={i} x={x} y={cy + ry * 0.35} width={rx * 0.22} height={thick + ry * 0.35} fill={face.stripe} opacity={0.95} />
      ))}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={face.base} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
      {top && (
        <>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 0.84}
            ry={ry * 0.84}
            fill="none"
            stroke={face.stripe}
            strokeWidth={ry * 0.42}
            strokeDasharray={`${rx * 0.42} ${rx * 0.42}`}
          />
          <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill={face.inlay} stroke={face.stripe} strokeWidth={0.5} />
        </>
      )}
    </g>
  );
}

/** A single chip seen from above, used in pickers and badges. */
export function ChipIcon({ face, size = 28 }: { face: ChipFace; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill={face.base} stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={face.stripe} strokeWidth="5" strokeDasharray="6.1 6.1" />
      <circle cx="20" cy="20" r="10" fill={face.inlay} stroke={face.stripe} strokeWidth="1" />
      <circle cx="20" cy="20" r="7.5" fill="none" stroke={face.base} strokeOpacity="0.6" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
