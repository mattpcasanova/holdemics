import type { Player } from "@/lib/types";
import { HPBar } from "./HPBar";
import { CardBack } from "./CardBack";

interface SeatProps {
  player: Player;
}

const POSITION_BADGE_STYLES: Record<string, string> = {
  D: "text-gold bg-gold/12",
  SB: "text-text-secondary bg-text-secondary/12",
  BB: "text-text-secondary bg-text-secondary/12",
  UTG: "text-text-secondary bg-text-secondary/12",
  MP: "text-text-secondary bg-text-secondary/12",
  CO: "text-text-secondary bg-text-secondary/12",
};

export function Seat({ player }: SeatProps) {
  const isFolded = player.status === "folded";
  const isOut = player.status === "out";
  const isActive = player.status === "active" || player.status === "acting";

  const borderColor = player.isHero
    ? "border-gold shadow-[0_0_0_1px_rgba(229,185,106,0.3)]"
    : isActive
      ? "border-felt shadow-[0_0_0_1px_rgba(31,111,74,0.3)]"
      : "border-border";

  const cardState = isFolded || isOut ? "folded" : "active";

  return (
    <div className="w-[150px]">
      {/* Card backs above seat */}
      <div className="flex justify-center gap-1 mb-[-10px] relative z-10">
        <CardBack state={cardState} size="sm" />
        <CardBack state={cardState} size="sm" />
      </div>

      {/* Seat card */}
      <div
        className={`bg-surface-deep border-[0.5px] rounded-lg p-2 pt-3.5 ${borderColor} ${
          isFolded || isOut ? "opacity-55" : ""
        }`}
      >
        {/* Player info row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div
            className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-medium ${
              isActive
                ? "bg-felt text-gold"
                : "bg-border text-text-secondary"
            }`}
          >
            {player.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[11px] font-medium leading-tight ${
                isActive ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {player.name}
            </div>
            <div className="text-[9px]">
              {isFolded ? (
                <span className="text-red-muted">folded</span>
              ) : isOut ? (
                <span className="text-red-muted">eliminated</span>
              ) : player.status === "acting" ? (
                <span className="text-felt font-medium">
                  acting &middot; {player.bbs} BBs
                </span>
              ) : (
                <span className="text-text-secondary">{player.bbs} BBs</span>
              )}
            </div>
          </div>
          {player.position && (
            <div
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                POSITION_BADGE_STYLES[player.position] ?? ""
              }`}
            >
              {player.position}
            </div>
          )}
        </div>

        {/* HP bar */}
        <HPBar hp={player.hp} maxHp={player.maxHp} bbs={player.bbs} />

        {/* Sub-info */}
        <div className="text-[9px] mt-0.5">
          {player.inPot ? (
            <span className={player.isHero ? "text-gold" : "text-text-tertiary"}>
              in pot &middot; {player.inPot}
              {player.isHero && " \u00b7 you"}
            </span>
          ) : (
            <span className="text-text-tertiary">
              {player.bbs} BBs
              {player.position === "D" && " \u00b7 button"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
