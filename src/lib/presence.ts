"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";

/**
 * One shared Realtime channel for everyone signed in: presence says who is
 * online and where (lobby, practice, or a table), and table invites are
 * broadcast on it. Nothing is stored; close the tab and you're offline.
 */

export type Where = "lobby" | "practice" | `table:${string}`;

export interface PresenceEntry {
  userId: string;
  username: string;
  where: Where;
}

export interface Invite {
  to: string;
  from: string;
  fromName: string;
  code: string;
  mode: string;
  at: number;
}

const CHANNEL = "holdemics:presence";

let channel: RealtimeChannel | null = null;
let me: PresenceEntry | null = null;
let online: Record<string, PresenceEntry> = {};
let invites: Invite[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function ensureChannel(): RealtimeChannel {
  if (channel) return channel;
  const supabase = createClient();
  channel = supabase.channel(CHANNEL, { config: { presence: { key: me?.userId } } });
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel!.presenceState<PresenceEntry>();
      const next: Record<string, PresenceEntry> = {};
      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (latest?.userId) next[latest.userId] = { userId: latest.userId, username: latest.username, where: latest.where };
      }
      online = next;
      notify();
    })
    .on("broadcast", { event: "invite" }, ({ payload }) => {
      const invite = payload as Invite;
      if (me && invite.to === me.userId && invite.from !== me.userId) {
        invites = [...invites.filter((i) => i.code !== invite.code), invite];
        notify();
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && me) await channel!.track(me);
    });
  return channel;
}

/** Announce (or update) where the signed-in player is. */
export async function trackPresence(entry: PresenceEntry) {
  me = entry;
  const ch = ensureChannel();
  if (ch.state === "joined") await ch.track(entry);
}

export function sendInvite(invite: Omit<Invite, "at">) {
  void ensureChannel().send({ type: "broadcast", event: "invite", payload: { ...invite, at: Date.now() } });
}

export function dismissInvite(code: string) {
  invites = invites.filter((i) => i.code !== code);
  notify();
}

const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getOnline: () => online,
  getInvites: () => invites,
};
const EMPTY_ONLINE: Record<string, PresenceEntry> = {};
const EMPTY_INVITES: Invite[] = [];

export function useOnline(): Record<string, PresenceEntry> {
  useEffect(() => {
    ensureChannel();
  }, []);
  return useSyncExternalStore(store.subscribe, store.getOnline, () => EMPTY_ONLINE);
}

export function useInvites(): Invite[] {
  return useSyncExternalStore(store.subscribe, store.getInvites, () => EMPTY_INVITES);
}

export function describeWhere(where: Where): string {
  if (where === "lobby") return "In the lobby";
  if (where === "practice") return "Practicing";
  return `At table ${where.slice(6)}`;
}
