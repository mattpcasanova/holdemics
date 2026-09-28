"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendsData } from "@/lib/friends";
import { describeWhere, useOnline } from "@/lib/presence";

export function FriendsPanel({ data }: { data: FriendsData }) {
  const router = useRouter();
  const online = useOnline();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const call = async (body: object, okText?: string) => {
    setBusy(true);
    const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string; username?: string };
    setBusy(false);
    if (!res.ok) return setNotice({ tone: "error", text: json.error ?? "Something went wrong." });
    if (okText) setNotice({ tone: "ok", text: okText.replace("%s", json.username ?? "") });
    router.refresh();
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    void call({ action: "request", username: username.trim() }, "Request sent to %s.").then(() => setUsername(""));
  };

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6 max-lg:grid-cols-1">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="friends-list-heading" className="rounded-xl border border-border bg-surface-primary p-4">
          <h2 id="friends-list-heading" className="font-display text-[15px] font-semibold">
            Friends <span className="text-text-tertiary">{data.friends.length}</span>
          </h2>
          {data.friends.length === 0 ? (
            <p className="mt-2 text-[13px] text-text-secondary">No friends yet. Add someone by their username.</p>
          ) : (
            <ul className="mt-3 flex flex-col">
              {data.friends.map((f) => {
                const presence = online[f.id];
                return (
                  <li key={f.id} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
                    <span className="relative">
                      <Avatar name={f.username} size={32} />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-primary ${presence ? "bg-felt-light" : "bg-text-tertiary"}`}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{f.username}</div>
                      <div className="text-[11.5px] text-text-tertiary">{presence ? describeWhere(presence.where) : "Offline"}</div>
                    </div>
                    <button
                      onClick={() => call({ action: "remove", userId: f.id })}
                      disabled={busy}
                      className="rounded-md px-2 py-1 text-[12px] text-text-tertiary hover:bg-white/5 hover:text-text-primary"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {data.incoming.length > 0 && (
          <section aria-labelledby="incoming-heading" className="rounded-xl border border-gold/40 bg-gold/[0.05] p-4">
            <h2 id="incoming-heading" className="font-display text-[15px] font-semibold">
              Requests for you
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {data.incoming.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <Avatar name={r.username} size={28} />
                  <span className="flex-1 text-[13.5px] font-medium">{r.username}</span>
                  <button
                    onClick={() => call({ action: "accept", userId: r.id })}
                    disabled={busy}
                    className="rounded-md bg-gold px-3 py-1.5 text-[12px] font-semibold text-surface-primary hover:brightness-110"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => call({ action: "remove", userId: r.id })}
                    disabled={busy}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-white/5"
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="add-heading" className="rounded-xl border border-border bg-surface-primary p-4">
          <h2 id="add-heading" className="font-display text-[15px] font-semibold">
            Add a friend
          </h2>
          <form onSubmit={send} className="mt-2 flex gap-1.5">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Their username"
              aria-label="Username"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-deep px-3 py-2 text-[13px] outline-none placeholder:text-text-tertiary focus:border-gold/60"
            />
            <button type="submit" disabled={busy} className="rounded-lg bg-gold px-3 text-[13px] font-semibold text-surface-primary hover:brightness-110 disabled:opacity-60">
              Send
            </button>
          </form>
          {notice && <p className={`mt-2 text-[12px] ${notice.tone === "ok" ? "text-felt-light" : "text-[#EFA3A3]"}`}>{notice.text}</p>}
        </section>

        {data.outgoing.length > 0 && (
          <section aria-labelledby="outgoing-heading" className="rounded-xl border border-border bg-surface-primary p-4">
            <h2 id="outgoing-heading" className="font-display text-[15px] font-semibold">
              Sent
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.outgoing.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-[13px]">
                  <span className="flex-1 truncate">{r.username}</span>
                  <span className="text-[11px] text-text-tertiary">pending</span>
                  <button onClick={() => call({ action: "remove", userId: r.id })} disabled={busy} className="text-[12px] text-text-tertiary hover:text-text-primary">
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
