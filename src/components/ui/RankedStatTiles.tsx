import type { ModeId } from "@/lib/engine/modes";
import { type RankedSummary, formatRate, showsTopHalf, topHalfRate, winRate } from "@/lib/rankedStats";

/**
 * lolchess-style record: Top 4 %, Win %, average place, games. Heads-Up drops
 * Top 4 (it's the win). `brief` keeps just the first two, for narrow cards.
 */
export function RankedStatTiles({ summary, mode, compact = false, brief = false }: { summary: RankedSummary; mode: ModeId; compact?: boolean; brief?: boolean }) {
  const all = [
    ...(showsTopHalf(mode) ? [{ label: "Top 4", value: formatRate(topHalfRate(summary)), accent: true }] : []),
    { label: "Win", value: formatRate(winRate(summary)), accent: !showsTopHalf(mode) },
    { label: "Avg place", value: summary.avgPlace === null ? "—" : summary.avgPlace.toFixed(1), accent: false },
    { label: "Games", value: String(summary.games), accent: false },
  ];
  const tiles = brief ? all.slice(0, 2) : all;
  return (
    <div className={`grid gap-1.5 ${["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][tiles.length]}`}>
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-lg bg-surface-deep text-center ${compact ? "px-1 py-1" : "px-2 py-2"}`}>
          <div className={`font-display font-semibold tabular-nums ${compact ? "text-[14px]" : "text-[17px]"} ${t.accent && summary.games ? "text-gold" : ""}`}>{t.value}</div>
          <div className="text-[10.5px] text-text-tertiary">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
