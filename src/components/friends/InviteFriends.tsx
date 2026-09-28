"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendsData } from "@/lib/friends";
import { type Where, sendInvite, useOnline } from "@/lib/presence";

function whereLabel(where: Where | undefined, code: string): { text: string; tone: string } {
  if (!where) return { text: "Offline", tone: "text-text-tertiary" };
  if (where === `table:${code}`) return { text: "Here", tone: "text-gold" };
  if (where.startsWith("table:")) return { text: "At another table", tone: "text-text-secondary" };
  if (where === "practice") return { text: "Practicing", tone: "text-text-secondary" };
  return { text: "In the lobby", tone: "text-felt-light" };
}

/**
 * A friend list for a private table's lobby: online friends first with an
 * Invite button, then everyone else greyed out, so the host can see at a
 * glance who could join.
 */
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

  const rows = friends
    .filter((f) => !seatedIds.includes(f.id))
    .map((f) => ({ ...f, where: online[f.id]?.where as Where | undefined }))
    .sort((a, b) => Number(!!b.where) - Number(!!a.where) || a.username.localeCompare(b.username));
  const onlineCount = rows.filter((r) => r.where).length;

  const invite = async (id: string) => {
    const failed = await sendInvite(id, code, modeId);
    if (failed) return setError(failed);
    setError(null);
    setSent((s) => ({ ...s, [id]: true }));
    setTimeout(
      () =>
        setSent((s) => {
          const rest = { ...s };
          delete rest[id];
          return rest;
        }),
      30_000,
    );
  };

  return (
    <section aria-labelledby="invite-heading" className="w-full max-w-[380px] rounded-xl border border-border bg-surface-deep text-left">
      <div className="flex items-baseline justify-between border-b border-border px-3.5 py-2.5">
        <h3 id="invite-heading" className="font-display text-[13.5px] font-semibold">
          Invite friends
        </h3>
        <span className="text-[11.5px] text-text-tertiary">
          {rows.length === 0 ? "No friends yet" : `${onlineCount} of ${rows.length} online`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-text-secondary">
          Add friends by username on the{" "}
          <Link href="/friends" className="text-gold underline-offset-2 hover:underline">
            Friends page
          </Link>
          , or just share the code above.
        </p>
      ) : (
        <ul className="max-h-[200px] overflow-y-auto">
          {rows.map((f) => {
            const status = whereLabel(f.where, code);
            const recently = !!sent[f.id];
            return (
              <li key={f.id} className={`flex items-center gap-2.5 px-3.5 py-2 ${f.where ? "" : "opacity-55"}`}>
                <span className="relative">
                  <Avatar name={f.username} avatar={f.avatar} size={26} />
                  <span
                    className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-surface-deep ${f.where ? "bg-felt-light" : "bg-text-tertiary"}`}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{f.username}</span>
                  <span className={`block text-[11px] ${status.tone}`}>{status.text}</span>
                </span>
                <button
                  onClick={() => invite(f.id)}
                  disabled={!f.where || recently}
                  className={`rounded-md border px-2.5 py-1 text-[12px] transition disabled:cursor-default ${
                    recently ? "border-gold/40 text-gold" : "border-border text-text-secondary hover:border-gold/60 hover:text-text-primary disabled:opacity-50"
                  }`}
                >
                  {recently ? "Invited" : "Invite"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="border-t border-border px-3.5 py-2 text-[12px] text-[#EFA3A3]">{error}</p>}
    </section>
  );
}
