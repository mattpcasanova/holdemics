import type { PlacementEntry } from "@/lib/types";
import { getHpTier, HP_TIER_TEXT_CLASSES } from "@/lib/hp";

interface PlacementPanelProps {
  entries: PlacementEntry[];
  averageHp: number;
}

export function PlacementPanel({ entries, averageHp }: PlacementPanelProps) {
  return (
    <div className="p-3 border-b-[0.5px] border-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-text-secondary tracking-widest font-medium">
          PLACEMENT
        </span>
        <span className="text-[9px] text-text-tertiary">avg {averageHp}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, i) => {
          const tier = getHpTier(entry.bbs);
          const isAboveLine = entry.rank <= 3;
          const showDivider = i > 0 && entries[i - 1].rank <= 3 && entry.rank > 3;

          return (
            <div key={entry.name}>
              {showDivider && (
                <div className="h-px bg-border my-0.5" />
              )}
              <div className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-medium ${
                      isAboveLine
                        ? "bg-gold/20 text-gold"
                        : "bg-red/15 text-red-muted"
                    }`}
                  >
                    {entry.rank}
                  </div>
                  <span
                    className={
                      entry.isHero
                        ? "text-gold font-medium"
                        : "text-text-primary"
                    }
                  >
                    {entry.isHero ? "you" : entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-text-tertiary">
                    {entry.bbs}bb
                  </span>
                  <span
                    className={`font-medium min-w-[26px] text-right ${HP_TIER_TEXT_CLASSES[tier]}`}
                  >
                    {entry.hp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
