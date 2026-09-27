import Link from "next/link";
import { SettingsButton } from "@/components/ui/SettingsDialog";

/** Compact header replacing the nav rail on small screens. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface-deep px-4 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-felt text-[15px] text-gold">♠</span>
        <span className="font-display text-[18px] font-semibold tracking-tight">holdemics</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/#practice" className="rounded-md px-2.5 py-1.5 text-[13px] text-text-secondary hover:bg-white/5">
          Practice
        </Link>
        <SettingsButton className="rounded-md px-2.5 py-1.5 text-[13px] text-text-secondary hover:bg-white/5">Settings</SettingsButton>
      </div>
    </header>
  );
}
