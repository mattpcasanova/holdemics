import { RARITY, TITLES } from "@/lib/cosmetics";

/**
 * A player's chosen title, set under their name in small caps and tinted by
 * the rarity of the achievement that earned it. Epic titles get a gradient
 * and legendary ones a slow gold shimmer, so the rarest stand out at a glance.
 */
export function PlayerTitle({ id, size = 10, className = "", wrap = false }: { id: string | null | undefined; size?: number; className?: string; wrap?: boolean }) {
  const title = id ? TITLES[id] : undefined;
  if (!title) return null;
  const special = title.rarity === "epic" || title.rarity === "legendary";
  return (
    <span className={`block font-display font-semibold uppercase ${wrap ? "text-center leading-[1.2]" : "truncate leading-none"} ${className}`} style={{ fontSize: size, letterSpacing: "0.12em" }} title={`${RARITY[title.rarity].label} title`}>
      <span
        className={special ? `title-${title.rarity}` : undefined}
        style={special ? undefined : { color: RARITY[title.rarity].color, textShadow: "0 0 10px rgba(0,0,0,0.5)" }}
      >
        {title.rarity === "legendary" && <span aria-hidden>✦ </span>}
        {title.text}
      </span>
    </span>
  );
}
