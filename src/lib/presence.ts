"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";

/**
 * Presence: one private Realtime channel for everyone signed in, saying who
 * is online and where. Invites: rows in `table_invites`, which RLS restricts
 * to friends and stamps with the real sender; recipients hear about them
 * over Postgres Changes on their own rows. Nothing else is stored.
 */

export type Where = "lobby" | "practice" | `table:${string}`;

export interface PresenceEntry {
  userId: string;
  username: string;
  where: Where;
}

export interface Invite {
  id: number;
  from: string;
  fromName: string;
  code: string;
  mode: string;
}

const PRESENCE_TOPIC = "holdemics:presence";

const supabase = () => createClient();
let presence: RealtimeChannel | null = null;
let inviteFeed: RealtimeChannel | null = null;
let me: PresenceEntry | null = null;
let online: Record<string, PresenceEntry> = {};
let invites: Invite[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function ensurePresence(): Promise<RealtimeChannel> {
  if (presence) return presence;
  const client = supabase();
  // Private channels are authorised with the user's JWT.
  await client.realtime.setAuth();
  presence = client.channel(PRESENCE_TOPIC, { config: { private: true, presence: { key: me?.userId } } });
  presence
    .on("presence", { event: "sync" }, () => {
      const state = presence!.presenceState<PresenceEntry>();
      const next: Record<string, PresenceEntry> = {};
      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (latest?.userId) next[latest.userId] = { userId: latest.userId, username: latest.username, where: latest.where };
      }
      online = next;
      notify();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && me) await presence!.track(me);
    });
  return presence;
}

async function ensureInviteFeed(userId: string) {
  if (inviteFeed) return;
  const client = supabase();
  await client.realtime.setAuth();
  inviteFeed = client
    .channel(`invites:${userId}`, { config: { private: true } })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "table_invites", filter: `to_id=eq.${userId}` },
      async ({ new: row }) => {
        const r = row as { id: number; from_id: string; code: string; mode: string };
        // The sender's name comes from their profile, never from the payload.
        const { data } = await client.from("profiles").select("username").eq("id", r.from_id).maybeSingle();
        invites = [...invites.filter((i) => i.code !== r.code), { id: r.id, from: r.from_id, fromName: data?.username ?? "A friend", code: r.code, mode: r.mode }];
        notify();
      },
    )
    .subscribe();
}

/** Announce (or update) where the signed-in player is, and start listening for invites. */
export async function trackPresence(entry: PresenceEntry) {
  me = entry;
  const ch = await ensurePresence();
  if (ch.state === "joined") await ch.track(entry);
  await ensureInviteFeed(entry.userId);
}

/** Invite a friend to a table. Returns an error message if the database refused it. */
export async function sendInvite(toId: string, code: string, mode: string): Promise<string | null> {
  if (!me) return "Not signed in.";
  const { error } = await supabase().from("table_invites").insert({ from_id: me.userId, to_id: toId, code, mode });
  return error ? (error.code === "42501" ? "You can only invite friends." : error.message) : null;
}

export function dismissInvite(id: number) {
  invites = invites.filter((i) => i.id !== id);
  notify();
  void supabase().from("table_invites").delete().eq("id", id);
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
    void ensurePresence();
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
