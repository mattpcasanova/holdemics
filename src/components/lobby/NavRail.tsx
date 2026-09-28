import Link from "next/link";
import { AccountBlock } from "@/components/lobby/AccountBlock";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import type { Profile } from "@/lib/account";

const ITEMS = [
  { label: "Play", href: "/", icon: "♠", live: true },
  { label: "Practice", href: "/#practice", icon: "♦", live: true },
  { label: "Friends", href: "/friends", icon: "♥", live: true },
  { label: "Leaderboard", href: "/leaderboard", icon: "♣", live: true },
];

export function NavRail({ active = "Play", profile }: { active?: string; profile: Profile | null }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 flex h-screen w-[200px] shrink-0 flex-col border-r border-border bg-surface-deep px-3 py-4 max-md:hidden"
    >
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-felt text-[15px] text-gold">♠</span>
        <span className="font-display text-[19px] font-semibold tracking-tight">holdemics</span>
      </Link>
      <ul className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          const isActive = item.label === active;
          const body = (
            <>
              <span className={`w-4 text-center ${isActive ? "text-gold" : "text-text-tertiary"}`}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {!item.live && <span className="text-[10px] text-text-tertiary">Soon</span>}
            </>
          );
          const cls = `flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] ${
            isActive ? "bg-white/[0.06] font-medium text-text-primary" : "text-text-secondary"
          }`;
          return (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href} className={`${cls} transition hover:bg-white/[0.04] hover:text-text-primary`}>
                  {body}
                </Link>
              ) : (
                <span className={`${cls} cursor-default opacity-60`}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
      <SettingsButton className="mt-auto mb-3 flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] text-text-secondary transition hover:bg-white/[0.04] hover:text-text-primary">
        <span className="w-4 text-center text-text-tertiary" aria-hidden>
          ⚙
        </span>
        Settings
      </SettingsButton>
      <AccountBlock profile={profile} />
    </nav>
  );
}
