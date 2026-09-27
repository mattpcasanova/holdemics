import { formatHp } from "@/lib/engine/modes";
import { ChipStack } from "./ChipStack";

interface PotDisplayProps {
  total: number;
  /** Main pot first, then side pots. */
  pots: number[];
  /** Chips physically in the middle (excludes bets still in front of players). */
  chips: number;
}

/** Chip pile on the felt with an engraved brass plaque for the total. */
export function PotDisplay({ total, pots, chips }: PotDisplayProps) {
  const sidePots = pots.length > 1 ? pots : [];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-[58px] items-end">{chips > 0 && <ChipStack amount={chips} scale={1.6} layout="pile" maxStacks={6} />}</div>
      <div
        className="relative flex items-baseline gap-2 rounded-[7px] px-3.5 py-1"
        style={{
          background: "linear-gradient(180deg, #F3D594 0%, #E5B96A 45%, #C99A4A 100%)",
          boxShadow:
            "0 3px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(90,60,15,0.5), 0 0 0 1px rgba(60,40,8,0.55)",
        }}
      >
        <span className="text-[10.5px] font-semibold text-[#5A3F0F]">Pot</span>
        <span
          className="font-display text-[19px] font-bold leading-tight tabular-nums text-[#2A1D06]"
          style={{ textShadow: "0 1px 0 rgba(255,240,200,0.6)" }}
        >
          {formatHp(total)}
        </span>
      </div>
      {sidePots.length > 0 && (
        <div className="flex gap-1.5 text-[11px] tabular-nums">
          {sidePots.map((amount, i) => (
            <span key={i} className="rounded-md bg-black/35 px-1.5 py-px text-felt-light">
              {i === 0 ? "Main" : `Side ${sidePots.length > 2 ? i : ""}`.trim()}{" "}
              <span className="font-semibold text-gold">{formatHp(amount)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
