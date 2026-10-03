"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FriendsBadge } from "@/components/friends/FriendsBadge";
import { Avatar } from "@/components/ui/Avatar";
import type { Profile } from "@/lib/account";
import { supabaseConfigured } from "@/lib/supabase/config";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: (path: string) => boolean;
  badge?: boolean;
}

/** App-style bottom navigation on small screens, where the nav rail is hidden. */
export function MobileTabBar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const glyph = (g: string) => <span className="text-[18px] leading-none">{g}</span>;
  const tabs: Tab[] = [
    { href: "/", label: "Play", icon: glyph("♠"), active: (p) => p === "/" },
    profile
      ? { href: "/friends", label: "Friends", icon: glyph("♥"), active: (p) => p.startsWith("/friends"), badge: true }
      : { href: "/#practice", label: "Practice", icon: glyph("♦"), active: () => false },
    { href: "/leaderboard", label: "Ranks", icon: glyph("♣"), active: (p) => p.startsWith("/leaderboard") },
    ...(profile
      ? [
          { href: "/achievements", label: "Awards", icon: glyph("★"), active: (p: string) => p.startsWith("/achievements") },
          {
            href: `/u/${encodeURIComponent(profile.username)}`,
            label: "Profile",
            icon: <Avatar name={profile.username} avatar={profile.avatar} size={22} />,
            active: (p: string) => p.toLowerCase() === `/u/${profile.username.toLowerCase()}`,
          },
        ]
      : supabaseConfigured
        ? [{ href: "/login", label: "Sign in", icon: glyph("→"), active: (p: string) => p.startsWith("/login") }]
        : []),
  ];

  return (
    <nav
      data-tabbar
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {tabs.map((tab) => {
        const on = tab.active(pathname);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? "text-gold" : "text-text-tertiary"}`}
          >
            <span className="relative flex h-6 items-center">
              {tab.icon}
              {tab.badge && <FriendsBadge className="absolute -right-3 -top-1.5" />}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
