import { avatarTone, initialsFor } from "@/lib/cosmetics";

interface AvatarProps {
  name: string;
  size?: number;
  ring?: "gold" | "felt" | "none";
  dimmed?: boolean;
}

export function Avatar({ name, size = 32, ring = "none", dimmed = false }: AvatarProps) {
  const tone = avatarTone(name);
  const ringColor = ring === "gold" ? "var(--gold)" : ring === "felt" ? "var(--felt)" : "transparent";
  return (
    <div
      aria-hidden
      className="rounded-full inline-flex items-center justify-center font-display font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: dimmed ? "var(--surface-card)" : tone.bg,
        color: dimmed ? "var(--text-tertiary)" : tone.fg,
        boxShadow: `0 0 0 2px ${ringColor}`,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
