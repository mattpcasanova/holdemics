import { type AvatarGlyph, AVATARS, avatarTone, initialsFor } from "@/lib/cosmetics";

interface AvatarProps {
  name: string;
  /** Avatar id from AVATARS; falls back to initials. */
  avatar?: string | null;
  size?: number;
  ring?: "gold" | "felt" | "none";
  dimmed?: boolean;
}

/** Glyphs drawn in a 32×32 box. */
const GLYPHS: Record<Exclude<AvatarGlyph, "initials">, React.ReactNode> = {
  spade: <path d="M16 5c3 5 8 8 8 13a5 5 0 0 1-7 4.5V26h-2v-3.5A5 5 0 0 1 8 18c0-5 5-8 8-13z" />,
  heart: <path d="M16 27C8 21 5 17 5 12.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 11 2.5C27 17 24 21 16 27z" />,
  diamond: <path d="M16 4l9 12-9 12-9-12z" />,
  club: <path d="M16 5a4.5 4.5 0 0 1 4 6.6A4.5 4.5 0 1 1 17.5 19H17v6h-2v-6h-.5A4.5 4.5 0 1 1 12 11.6 4.5 4.5 0 0 1 16 5z" />,
  chip: (
    <>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="5.8 5.7" />
      <circle cx="16" cy="16" r="5.5" fill="currentColor" />
    </>
  ),
  crown: <path d="M6 22l-1-12 6 5 5-8 5 8 6-5-1 12zm0 2h20v3H6z" />,
  fish: (
    <>
      <path d="M5 16c4-6 10-8 17-4l5-4v16l-5-4c-7 4-13 2-17-4z" />
      <circle cx="11" cy="15" r="1.6" fill="#000" fillOpacity="0.45" />
    </>
  ),
  shark: <path d="M4 24c6-1 10-4 13-12l3-8c4 4 6 10 6 20z" />,
  ace: (
    <>
      <rect x="9" y="4" width="14" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 10l3.5 10h-2l-.7-2h-1.6l-.7 2h-2zm0 4l-.6 2.2h1.2z" />
    </>
  ),
  dice: (
    <>
      <rect x="6" y="6" width="20" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="11.5" cy="11.5" r="1.8" />
      <circle cx="20.5" cy="11.5" r="1.8" />
      <circle cx="16" cy="16" r="1.8" />
      <circle cx="11.5" cy="20.5" r="1.8" />
      <circle cx="20.5" cy="20.5" r="1.8" />
    </>
  ),
  flame: <path d="M16 4c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2 1 3 2 3.5-1-4 0-7 1-10z" />,
};

export function Avatar({ name, avatar, size = 32, ring = "none", dimmed = false }: AvatarProps) {
  const skin = avatar && avatar !== "initials" ? AVATARS[avatar] : undefined;
  const tone = avatarTone(name);
  const ringColor = ring === "gold" ? "var(--gold)" : ring === "felt" ? "var(--felt)" : "transparent";
  return (
    <div
      aria-hidden
      className="rounded-full inline-flex items-center justify-center font-display font-semibold shrink-0 select-none overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: dimmed ? "var(--surface-card)" : (skin?.bg ?? tone.bg),
        color: dimmed ? "var(--text-tertiary)" : (skin?.fg ?? tone.fg),
        boxShadow: `0 0 0 2px ${ringColor}`,
      }}
    >
      {skin && skin.glyph !== "initials" ? (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 32 32" fill="currentColor">
          {GLYPHS[skin.glyph]}
        </svg>
      ) : (
        initialsFor(name)
      )}
    </div>
  );
}
