import { type PlayerTag, PLAYER_TAGS } from "@/lib/notes";

const PATHS: Record<PlayerTag, React.ReactNode> = {
  fish: (
    <>
      <path d="M3 12c3-5 10-6 14-1l4-3v8l-4-3c-4 5-11 4-14-1Z" fill="currentColor" />
      <circle cx="8" cy="11" r="1" fill="var(--surface-deep)" />
    </>
  ),
  whale: (
    <>
      <path d="M2 13c0-4 4-6 9-6 5 0 8 2 9 5l2-2v5l-2-1c-2 3-6 4-10 4-5 0-8-2-8-5Z" fill="currentColor" />
      <path d="M10 6c0-2 1-3 2-3M10 6c0-2-1-3-2-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="7" cy="12" r="1" fill="var(--surface-deep)" />
    </>
  ),
  nit: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
    </>
  ),
  reg: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  shark: (
    <>
      <path d="M4 17c2-1 4-9 11-12-1 4 0 9 3 12Z" fill="currentColor" />
      <path d="M2 19c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  maniac: (
    <path
      d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z"
      fill="currentColor"
    />
  ),
};

export function TagIcon({ tag, size = 14 }: { tag: PlayerTag; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ color: PLAYER_TAGS[tag].color }}>
      {PATHS[tag]}
    </svg>
  );
}
