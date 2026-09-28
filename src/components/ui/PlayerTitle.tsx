import { RARITY, TITLES } from "@/lib/cosmetics";

/**
 * A player's chosen title, set under their name in small caps and tinted
 * by the rarity of the achievement that earned it.
 */
export function PlayerTitle({ id, size = 10, className = "" }: { id: string | null | undefined; size?: number; className?: string }) {
  const title = id ? TITLES[id] : undefined;
  if (!title) return null;
  return (
    <span
      className={`block truncate font-display font-semibold uppercase leading-none ${className}`}
      style={{ fontSize: size, letterSpacing: "0.12em", color: RARITY[title.rarity].color, textShadow: "0 0 10px rgba(0,0,0,0.5)" }}
      title={`${RARITY[title.rarity].label} title`}
    >
      {title.text}
    </span>
  );
}
