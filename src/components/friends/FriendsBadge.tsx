"use client";

import { usePendingRequests } from "@/lib/presence";

/** Gold count of friend requests waiting on the signed-in player; renders nothing at zero. */
export function FriendsBadge({ className = "" }: { className?: string }) {
  const count = usePendingRequests();
  if (!count) return null;
  return (
    <span
      aria-label={`${count} friend request${count === 1 ? "" : "s"}`}
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[11px] font-semibold leading-none text-surface-primary ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
