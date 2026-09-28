import type { Achievement } from "@/lib/achievements";

/** A poker-chip style badge: gold when earned, greyed when not. */
export function AchievementBadge({ achievement, earned, size = 44 }: { achievement: Achievement; earned: boolean; size?: number }) {
  const red = achievement.glyph === "♥" || achievement.glyph === "♦";
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <circle cx="22" cy="22" r="21" fill={earned ? "#E5B96A" : "#2B2F36"} stroke={earned ? "#8A6E2E" : "#1A1D21"} strokeWidth="1" />
      <circle cx="22" cy="22" r="17" fill="none" stroke={earned ? "#F7E6BF" : "#3A3F47"} strokeWidth="5" strokeDasharray="7.6 5.7" />
      <circle cx="22" cy="22" r="11" fill={earned ? "#F4F1EA" : "#1E2126"} stroke={earned ? "#8A6E2E" : "#2B2F36"} strokeWidth="1" />
      <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="700" fill={earned ? (red ? "#C8323A" : "#1A1D21") : "#6B7178"}>
        {achievement.glyph}
      </text>
    </svg>
  );
}
