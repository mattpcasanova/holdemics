import type { Player, Card as CardType } from "@/lib/types";
import { Seat } from "./Seat";
import { ChipStack } from "./ChipStack";
import { CardFace } from "./CardFace";
import { CardBack } from "./CardBack";

interface FeltProps {
  players: Player[];
  pot: number;
  communityCards: CardType[];
  street: string;
}

// 6-max seat positions around the oval
const SEAT_POSITIONS = [
  { top: "-10px", left: "8%", label: "top-left" },       // SB
  { top: "-10px", right: "8%", label: "top-right" },      // BB
  { top: "38%", left: "-2%", label: "mid-left" },          // UTG
  { top: "38%", right: "-2%", label: "mid-right" },        // CO/MP
  { bottom: "-10px", left: "18%", label: "bottom-left" },  // D
  { bottom: "-10px", right: "18%", label: "bottom-right" }, // Hero
];

export function Felt({ players, pot, communityCards, street }: FeltProps) {
  return (
    <div
      className="relative w-full min-h-[500px] rounded-[220px_/_150px] border-[6px] border-surface-deep"
      style={{
        background:
          "radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-deep) 70%, var(--felt-deepest) 100%)",
        boxShadow: "inset 0 0 0 1px rgba(229,185,106,0.2)",
      }}
    >
      {/* Center: deck + pot + chips */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
        <CardBack variant="default" state="active" size="lg" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-felt-light tracking-widest">POT</span>
          <span className="font-display text-[26px] font-medium text-gold tracking-tight leading-none">
            {pot}
          </span>
        </div>
        <ChipStack pot={pot} />
        <span className="text-[9px] text-felt-muted -mt-1.5">{street}</span>
      </div>

      {/* Community cards */}
      {communityCards.length > 0 && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 flex gap-1.5">
          {communityCards.map((card, i) => (
            <CardFace key={i} card={card} size="sm" />
          ))}
        </div>
      )}

      {/* Seats */}
      {players.map((player, i) => {
        const pos = SEAT_POSITIONS[i];
        if (!pos) return null;

        const style: React.CSSProperties = {};
        if (pos.top) style.top = pos.top;
        if (pos.bottom) style.bottom = pos.bottom;
        if (pos.left) style.left = pos.left;
        if ("right" in pos && pos.right) style.right = pos.right;

        return (
          <div key={player.id} className="absolute" style={style}>
            <Seat player={player} />
          </div>
        );
      })}
    </div>
  );
}
