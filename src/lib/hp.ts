export type HpTier = "green" | "gold" | "red";

export function getHpTier(bbs: number): HpTier {
  if (bbs >= 25) return "green";
  if (bbs >= 15) return "gold";
  return "red";
}

export const HP_TIER_COLORS: Record<HpTier, string> = {
  green: "var(--felt)",
  gold: "var(--gold)",
  red: "var(--red)",
};

export const HP_TIER_TEXT_CLASSES: Record<HpTier, string> = {
  green: "text-felt",
  gold: "text-gold",
  red: "text-red",
};
