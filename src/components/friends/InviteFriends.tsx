"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendsData } from "@/lib/friends";
import { sendInvite, useOnline } from "@/lib/presence";

/** Online friends with one-click invites, shown in a private table's lobby. */
export function InviteFriends({ code, modeId, seatedIds }: { code: string; modeId: string; seatedIds: string[] }) {
  const online = useOnline();
  const [friends, setFriends] = useState<FriendsData["friends"] | null>(null);
  // Friends invited in the last 30 seconds; cleared on a timer so the button re-enables.
  const [sent, setSent] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/friends")
      .then((r) => (r.ok ? (r.json() as Promise<FriendsData>) : null))
      .then((d) => setFriends(d?.friends ?? []));
  }, []);

  if (!friends) return null;
  const candidates = friends.filter((f) => online[f.id] && !seatedIds.includes(f.id));
  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-text-secondary">
      <span>Online friends:</span>
      {candidates.map((f) => {
        const recently = !!sent[f.id];
        return (
          <button
            key={f.id}
            disabled={!!recently}
            onClick={async () => {
              const failed = await sendInvite(f.id, code, modeId);
              if (failed) return setError(failed);
              setError(null);
              setSent((s) => ({ ...s, [f.id]: true }));
              setTimeout(
                () =>
                  setSent((s) => {
                    const rest = { ...s };
                    delete rest[f.id];
                    return rest;
                  }),
                30_000,
              );
            }}
            className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-2.5 transition hover:border-gold/60 hover:text-text-primary disabled:opacity-60"
          >
            <Avatar name={f.username} size={20} />
            {f.username}
            <span className="text-[11px] text-gold">{recently ? "Invited" : "Invite"}</span>
          </button>
        );
      })}
      {error && <span className="text-[#EFA3A3]">{error}</span>}
    </div>
  );
}
