import Link from "next/link";
import { MobileTabBar } from "@/components/lobby/MobileTabBar";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import type { Profile } from "@/lib/account";

/** Compact header plus bottom tab bar, replacing the nav rail on small screens. */
export function MobileTopBar({ profile }: { profile: Profile | null }) {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface-deep px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-felt text-[15px] text-gold">♠</span>
          <span className="font-display text-[18px] font-semibold tracking-tight">holdemics</span>
        </Link>
        <SettingsButton className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-text-secondary hover:bg-white/5">
          <span aria-hidden>⚙</span> Settings
        </SettingsButton>
      </header>
      <MobileTabBar profile={profile} />
    </>
  );
}
