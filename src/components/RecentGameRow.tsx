import type { RecentGame } from "@/lib/types";

interface RecentGameRowProps {
  game: RecentGame;
  isLast?: boolean;
}

function placementStyle(placement: number) {
  if (placement <= 2) return { bg: "bg-gold/15", text: "text-gold" };
  if (placement === 3) return { bg: "bg-text-secondary/12", text: "text-text-secondary" };
  return { bg: "bg-red/12", text: "text-red" };
}

export function RecentGameRow({ game, isLast }: RecentGameRowProps) {
  const ps = placementStyle(game.placement);
  const isGain = game.ratingChange > 0;

  return (
    <div
      className={`grid grid-cols-[40px_1fr_80px_60px] gap-2.5 py-2.5 px-3.5 items-center ${
        !isLast ? "border-b-[0.5px] border-border" : ""
      }`}
    >
      <div
        className={`w-[26px] h-[26px] rounded-full inline-flex items-center justify-center text-[11px] font-medium ${ps.bg} ${ps.text}`}
      >
        {game.placement}
      </div>
      <div>
        <div className="text-xs text-text-primary">
          {game.mode} &middot; {game.bbs}bb
        </div>
        <div className="text-[10px] text-text-tertiary">
          {game.duration} &middot; {game.playerCount} players
        </div>
      </div>
      <div
        className={`text-xs font-medium ${isGain ? "text-felt" : "text-red"}`}
      >
        {isGain ? "+" : "\u2212"}
        {Math.abs(game.ratingChange)}
      </div>
      <div className="text-[11px] text-text-tertiary">{game.timeAgo}</div>
    </div>
  );
}
