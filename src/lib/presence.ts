"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";

/**
 * Presence: one private Realtime channel for everyone signed in, saying who
 * is online and where. Invites: rows in `table_invites`, which RLS restricts
 * to friends and stamps with the real sender; recipients hear about them
 * over Postgres Changes on their own rows. Nothing else is stored.
 * Friend requests ride the same per-player feed: new requests to you and
 * acceptances of yours become notices, and the pending count drives badges.
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

export interface FriendNotice {
  id: string;
  kind: "request" | "accepted";
  userId: string;
  username: string;
}

const PRESENCE_TOPIC = "holdemics:presence";

const supabase = () => createClient();
let presence: RealtimeChannel | null = null;
let inviteFeed: RealtimeChannel | null = null;
let me: PresenceEntry | null = null;
let online: Record<string, PresenceEntry> = {};
let invites: Invite[] = [];
let feedUser: string | null = null;
let pendingRequests = 0;
let friendNotices: FriendNotice[] = [];
// Bumped on every friend change so open friend lists know to reload.
let friendsVersion = 0;
let achievementNotices: string[] = [];
const announced = new Set<string>();
const ACTIVE_TABLE_KEY = "holdemics:activeTable";
let activeTable: string | null = null;
try {
  activeTable = typeof window === "undefined" ? null : window.sessionStorage.getItem(ACTIVE_TABLE_KEY);
} catch {
  // Storage blocked: the "back to your table" pill just won't survive reloads.
}
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Callers race on first use (useOnline and trackPresence mount together), so share one join.
let joining: Promise<RealtimeChannel> | null = null;
function ensurePresence(): Promise<RealtimeChannel> {
  joining ??= joinPresence();
  return joining;
}

async function joinPresence(): Promise<RealtimeChannel> {
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

async function usernameOf(id: string): Promise<string | null> {
  const { data } = await supabase().from("profiles").select("username").eq("id", id).maybeSingle();
  return data?.username ?? null;
}

function pushFriendNotice(notice: FriendNotice) {
  friendNotices = [...friendNotices.filter((n) => n.id !== notice.id), notice];
  friendsVersion++;
  notify();
}

/** Recount pending requests sent to the signed-in player (after accepting, declining, or a live change). */
export async function refreshFriendRequests() {
  if (!feedUser) return;
  const { count } = await supabase()
    .from("friend_requests")
    .select("from_id", { count: "exact", head: true })
    .eq("to_id", feedUser)
    .eq("status", "pending");
  pendingRequests = count ?? 0;
  notify();
}

async function ensureInviteFeed(userId: string) {
  if (inviteFeed || feedUser) return;
  feedUser = userId;
  void refreshFriendRequests();
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
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "friend_requests", filter: `to_id=eq.${userId}` },
      async ({ new: row }) => {
        const r = row as { from_id: string; status: string };
        if (r.status !== "pending") return;
        void refreshFriendRequests();
        pushFriendNotice({ id: `request:${r.from_id}`, kind: "request", userId: r.from_id, username: (await usernameOf(r.from_id)) ?? "Someone" });
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "friend_requests", filter: `from_id=eq.${userId}` },
      async ({ new: row }) => {
        const r = row as { to_id: string; status: string };
        if (r.status !== "accepted") return;
        pushFriendNotice({ id: `accepted:${r.to_id}`, kind: "accepted", userId: r.to_id, username: (await usernameOf(r.to_id)) ?? "A player" });
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

export function dismissFriendNotice(id: string) {
  friendNotices = friendNotices.filter((n) => n.id !== id);
  notify();
}

/** Accept or decline a friend request from a notice. Returns an error message on failure. */
export async function answerFriendRequest(userId: string, accept: boolean): Promise<string | null> {
  const res = await fetch("/api/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: accept ? "accept" : "remove", userId }),
  });
  if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.";
  friendNotices = friendNotices.filter((n) => n.id !== `request:${userId}`);
  friendsVersion++;
  await refreshFriendRequests();
  return null;
}

/** Toast achievements earned at a table; each one only once per table and session. */
export function announceAchievements(tableCode: string, ids: string[]) {
  const fresh = ids.filter((id) => !announced.has(`${tableCode}:${id}`));
  if (!fresh.length) return;
  for (const id of fresh) announced.add(`${tableCode}:${id}`);
  achievementNotices = [...achievementNotices, ...fresh.filter((id) => !achievementNotices.includes(id))];
  notify();
}

export function dismissAchievement(id: string) {
  achievementNotices = achievementNotices.filter((n) => n !== id);
  notify();
}

/** The table the player has a game in progress at, so other pages can offer a way back. */
export function setActiveTable(code: string | null) {
  if (code === activeTable) return;
  activeTable = code;
  try {
    if (code) window.sessionStorage.setItem(ACTIVE_TABLE_KEY, code);
    else window.sessionStorage.removeItem(ACTIVE_TABLE_KEY);
  } catch {
    // Ignore; in-memory value still works for this page load.
  }
  notify();
}

/** Forget the active table, but only if it's this one. */
export function clearActiveTable(code: string) {
  if (activeTable === code) setActiveTable(null);
}

const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getOnline: () => online,
  getInvites: () => invites,
  getPendingRequests: () => pendingRequests,
  getFriendNotices: () => friendNotices,
  getFriendsVersion: () => friendsVersion,
  getAchievementNotices: () => achievementNotices,
  getActiveTable: () => activeTable,
};
const EMPTY_ONLINE: Record<string, PresenceEntry> = {};
const EMPTY_INVITES: Invite[] = [];
const EMPTY_NOTICES: FriendNotice[] = [];
const EMPTY_IDS: string[] = [];

export function useOnline(): Record<string, PresenceEntry> {
  useEffect(() => {
    void ensurePresence();
  }, []);
  return useSyncExternalStore(store.subscribe, store.getOnline, () => EMPTY_ONLINE);
}

export function useInvites(): Invite[] {
  return useSyncExternalStore(store.subscribe, store.getInvites, () => EMPTY_INVITES);
}

/** Friend requests waiting on the signed-in player. */
export function usePendingRequests(): number {
  return useSyncExternalStore(store.subscribe, store.getPendingRequests, () => 0);
}

export function useFriendNotices(): FriendNotice[] {
  return useSyncExternalStore(store.subscribe, store.getFriendNotices, () => EMPTY_NOTICES);
}

/** Changes whenever a friend request arrives, is accepted, or is answered here. */
export function useFriendsVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getFriendsVersion, () => 0);
}

export function useAchievementNotices(): string[] {
  return useSyncExternalStore(store.subscribe, store.getAchievementNotices, () => EMPTY_IDS);
}

export function useActiveTable(): string | null {
  return useSyncExternalStore(store.subscribe, store.getActiveTable, () => null);
}

export function describeWhere(where: Where): string {
  if (where === "lobby") return "In the lobby";
  if (where === "practice") return "Practicing";
  return `At table ${where.slice(6)}`;
}
