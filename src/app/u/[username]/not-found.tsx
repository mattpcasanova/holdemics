import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-[24px] font-semibold">No player by that name</div>
      <p className="max-w-[40ch] text-[14px] text-text-secondary">Check the spelling. Usernames are 3–20 letters, numbers, or underscores.</p>
      <Link href="/leaderboard" className="rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110">
        Browse the leaderboard
      </Link>
    </div>
  );
}
