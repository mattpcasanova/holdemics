import type { CardBackVariant, CardBackState } from "@/lib/types";

interface CardBackProps {
  variant?: CardBackVariant;
  state?: CardBackState;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { w: 32, h: 44, emblem: 14, emblemFont: 8 },
  md: { w: 36, h: 50, emblem: 16, emblemFont: 9 },
  lg: { w: 56, h: 78, emblem: 22, emblemFont: 13 },
};

export function CardBack({
  variant: _variant = "default",
  state = "active",
  size = "sm",
}: CardBackProps) {
  const s = SIZES[size];
  const isFolded = state === "folded" || state === "out";

  return (
    <div
      className="rounded transition-opacity"
      style={{
        width: s.w,
        height: s.h,
        opacity: isFolded ? 0.4 : 1,
        background: "var(--surface-deep)",
        border: isFolded
          ? "0.5px solid var(--border)"
          : "0.5px solid rgba(31,111,74,0.6)",
        padding: 3,
        boxSizing: "border-box",
      }}
    >
      <div
        className="w-full h-full rounded-sm relative"
        style={{
          background: isFolded
            ? "repeating-linear-gradient(45deg, var(--border), var(--border) 2px, var(--surface-primary) 2px, var(--surface-primary) 4px)"
            : "repeating-linear-gradient(45deg, var(--felt), var(--felt) 2px, var(--felt-deep) 2px, var(--felt-deep) 4px)",
        }}
      >
        {!isFolded && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-deep flex items-center justify-center text-gold"
            style={{
              width: s.emblem,
              height: s.emblem,
              fontSize: s.emblemFont,
            }}
          >
            &#9824;
          </div>
        )}
      </div>
    </div>
  );
}
