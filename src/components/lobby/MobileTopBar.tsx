import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import type { Profile } from "@/lib/account";
import { supabaseConfigured } from "@/lib/supabase/config";

/** Compact header replacing the nav rail on small screens. */
export function MobileTopBar({ profile }: { profile: Profile | null }) {
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
        {profile ? (
          <span className="ml-1" title={profile.username}>
            <Avatar name={profile.username} avatar={profile.avatar} size={28} />
          </span>
        ) : (
          supabaseConfigured && (
            <Link href="/login" className="ml-1 rounded-md bg-gold px-2.5 py-1.5 text-[13px] font-semibold text-surface-primary">
              Sign in
            </Link>
          )
        )}
      </div>
    </header>
  );
}
