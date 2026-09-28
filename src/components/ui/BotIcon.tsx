/** A small robot mark for bot seats, tinted by difficulty. */
export function BotIcon({ size = 36, color = "#9AA0A6", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden className={className}>
      <circle cx="18" cy="18" r="17" fill="#1E2126" stroke="#2B2F36" />
      <line x1="18" y1="7" x2="18" y2="11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="18" cy="6" r="1.6" fill={color} />
      <rect x="9" y="11" width="18" height="14" rx="4" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="12.5" y="15.5" width="4" height="3.5" rx="1" fill={color} />
      <rect x="19.5" y="15.5" width="4" height="3.5" rx="1" fill={color} />
      <line x1="14" y1="22" x2="22" y2="22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6.5" y1="16" x2="6.5" y2="20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="29.5" y1="16" x2="29.5" y2="20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const BOT_LEVEL_COLORS = { easy: "#9FCFB6", medium: "#E5B96A", hard: "#EFA3A3" } as const;
