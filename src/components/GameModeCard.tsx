import type { GameMode } from "@/lib/types";

interface GameModeCardProps {
  mode: GameMode;
}

const BADGE_STYLES = {
  felt: "text-felt bg-felt/15",
  gold: "text-gold bg-gold/12",
  gray: "text-text-secondary bg-text-secondary/12",
};

export function GameModeCard({ mode }: GameModeCardProps) {
  return (
    <div className="bg-surface-card border-[0.5px] border-border rounded-lg p-3.5">
      <div className="flex justify-between items-start mb-2">
        <div className="font-display text-[15px] font-medium text-text-primary">
          {mode.name}
        </div>
        <div
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BADGE_STYLES[mode.badge.color]}`}
        >
          {mode.badge.text}
        </div>
      </div>
      <div className="text-[11px] text-text-secondary leading-relaxed mb-2.5">
        {mode.description}
      </div>
      <div className="text-[10px] text-text-tertiary">{mode.duration} &middot; {mode.playerCount}</div>
    </div>
  );
}
