import { getHpTier, HP_TIER_COLORS, HP_TIER_TEXT_CLASSES } from "@/lib/hp";

interface HPBarProps {
  hp: number;
  maxHp: number;
  bbs: number;
}

export function HPBar({ hp, maxHp, bbs }: HPBarProps) {
  const tier = getHpTier(bbs);
  const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));

  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: HP_TIER_COLORS[tier],
          }}
        />
      </div>
      <span
        className={`font-display text-[11px] font-medium min-w-[26px] text-right ${HP_TIER_TEXT_CLASSES[tier]}`}
      >
        {hp}
      </span>
    </div>
  );
}
