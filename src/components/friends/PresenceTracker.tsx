"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { type ModeId, MODES } from "@/lib/engine/modes";
import { type Where, dismissInvite, trackPresence, useInvites } from "@/lib/presence";

/** Announces where the signed-in player is, and shows incoming table invites. */
export function PresenceTracker({ userId, username }: { userId: string; username: string }) {
  const pathname = usePathname();
  const invites = useInvites();

  useEffect(() => {
    const table = pathname.match(/^\/table\/([A-Z0-9]+)/i);
    const where: Where = table ? `table:${table[1].toUpperCase()}` : pathname.startsWith("/practice") ? "practice" : "lobby";
    void trackPresence({ userId, username, where });
  }, [pathname, userId, username]);

  if (!invites.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2">
      {invites.map((invite) => (
        <div
          key={invite.id}
          role="status"
          className="flex items-center gap-3 rounded-xl border border-gold/50 bg-surface-primary px-4 py-3 shadow-2xl"
          style={{ animation: "pop-in 200ms ease-out both" }}
        >
          <div>
            <div className="text-[13px] font-medium">
              <span className="text-gold">{invite.fromName}</span> invited you to a {MODES[invite.mode as ModeId]?.name ?? invite.mode} table
            </div>
            <div className="text-[11.5px] text-text-tertiary">Code {invite.code}</div>
          </div>
          <Link
            href={`/table/${invite.code}`}
            onClick={() => dismissInvite(invite.id)}
            className="rounded-lg bg-gold px-3 py-1.5 font-display text-[13px] font-semibold text-surface-primary hover:brightness-110"
          >
            Join
          </Link>
          <button onClick={() => dismissInvite(invite.id)} aria-label="Dismiss" className="text-[18px] leading-none text-text-tertiary hover:text-text-primary">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
