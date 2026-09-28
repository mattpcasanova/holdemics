import type { Achievement } from "@/lib/achievements";
import { RARITY } from "@/lib/cosmetics";

/** A poker-chip style badge tinted by rarity when earned, greyed when not. */
export function AchievementBadge({ achievement, earned, size = 44 }: { achievement: Achievement; earned: boolean; size?: number }) {
  const red = achievement.glyph === "♥" || achievement.glyph === "♦";
  const tint = RARITY[achievement.rarity].color;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <circle cx="22" cy="22" r="21" fill={earned ? tint : "#2B2F36"} stroke={earned ? "rgba(0,0,0,0.35)" : "#1A1D21"} strokeWidth="1" />
      <circle cx="22" cy="22" r="17" fill="none" stroke={earned ? "rgba(255,255,255,0.75)" : "#3A3F47"} strokeWidth="5" strokeDasharray="7.6 5.7" />
      <circle cx="22" cy="22" r="11" fill={earned ? "#F4F1EA" : "#1E2126"} stroke={earned ? "rgba(0,0,0,0.35)" : "#2B2F36"} strokeWidth="1" />
      <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="700" fill={earned ? (red ? "#C8323A" : "#1A1D21") : "#6B7178"}>
        {achievement.glyph}
      </text>
    </svg>
  );
}
