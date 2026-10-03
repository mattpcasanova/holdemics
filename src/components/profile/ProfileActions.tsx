"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Relationship } from "@/lib/profile";
import { describeWhere, refreshFriendRequests, useOnline } from "@/lib/presence";

/** Online dot and where they are; presence is only visible to signed-in players. */
export function ProfilePresence({ userId }: { userId: string }) {
  const online = useOnline();
  const entry = online[userId];
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-text-secondary">
      <span className={`h-2 w-2 rounded-full ${entry ? "bg-felt-light" : "bg-text-tertiary"}`} aria-hidden />
      {entry ? describeWhere(entry.where) : "Offline"}
    </span>
  );
}

/** Add / cancel / accept / remove, depending on where the viewer stands with this player. */
export function FriendButton({ userId, username, relationship }: { userId: string; username: string; relationship: Relationship }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const call = async (body: object) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    setMenuOpen(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
      return;
    }
    router.refresh();
    void refreshFriendRequests();
  };

  const secondary = "rounded-lg border border-border px-3.5 py-2 text-[13px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary disabled:opacity-60";
  const primary = "rounded-lg bg-gold px-3.5 py-2 font-display text-[13px] font-semibold text-surface-primary transition hover:brightness-110 disabled:opacity-60";

  let control: React.ReactNode = null;
  if (relationship === "none") {
    control = (
      <button className={primary} disabled={busy} onClick={() => call({ action: "request", username })}>
        Add friend
      </button>
    );
  } else if (relationship === "outgoing") {
    control = (
      <button className={secondary} disabled={busy} onClick={() => call({ action: "remove", userId })} title="Cancel request">
        Request sent · Cancel
      </button>
    );
  } else if (relationship === "incoming") {
    control = (
      <div className="flex gap-2">
        <button className={primary} disabled={busy} onClick={() => call({ action: "accept", userId })}>
          Accept request
        </button>
        <button className={secondary} disabled={busy} onClick={() => call({ action: "remove", userId })}>
          Decline
        </button>
      </div>
    );
  } else if (relationship === "friends") {
    control = (
      <div ref={menuRef} className="relative">
        <button className={secondary} disabled={busy} onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
          <span className="text-felt-light">✓</span> Friends
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-surface-primary p-1 shadow-2xl">
            <button
              role="menuitem"
              onClick={() => call({ action: "remove", userId })}
              className="w-full rounded-md px-3 py-2 text-left text-[13px] text-[#EFA3A3] hover:bg-white/5"
            >
              Remove friend
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!control) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {control}
      {error && <p className="text-[12px] text-[#EFA3A3]">{error}</p>}
    </div>
  );
}
