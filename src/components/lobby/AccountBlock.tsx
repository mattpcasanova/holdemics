import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/Avatar";
import type { Profile } from "@/lib/account";
import { supabaseConfigured } from "@/lib/supabase/config";

/** Bottom of the nav rail: who you're signed in as, or a way to sign in. */
export function AccountBlock({ profile }: { profile: Profile | null }) {
  if (profile) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
        <Avatar name={profile.username} avatar={profile.avatar} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{profile.username}</div>
          <form action={signOut}>
            <button className="text-[11.5px] text-text-tertiary hover:text-text-primary">Sign out</button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[13px] font-medium">Playing as guest</div>
      {supabaseConfigured ? (
        <div className="mt-2 flex gap-1.5">
          <Link href="/signup" className="flex-1 rounded-md bg-gold py-1.5 text-center text-[12px] font-semibold text-surface-primary hover:brightness-110">
            Sign up
          </Link>
          <Link href="/login" className="flex-1 rounded-md border border-border py-1.5 text-center text-[12px] text-text-secondary hover:bg-white/5 hover:text-text-primary">
            Sign in
          </Link>
        </div>
      ) : (
        <p className="mt-0.5 text-[11.5px] leading-snug text-text-tertiary">Accounts turn on once the database is connected.</p>
      )}
    </div>
  );
}
