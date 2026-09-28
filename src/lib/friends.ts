import { createClient } from "./supabase/server";

export interface FriendEntry {
  id: string;
  username: string;
  avatar: string;
  since: string;
}

export interface FriendRequestEntry {
  id: string;
  username: string;
  avatar: string;
  at: string;
}

export interface FriendsData {
  friends: FriendEntry[];
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
}

/** Friends and pending requests for the signed-in player. */
export async function getFriends(viewerId: string): Promise<FriendsData> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("friend_requests")
    .select("from_id, to_id, status, created_at, responded_at")
    .or(`from_id.eq.${viewerId},to_id.eq.${viewerId}`);
  const requests = rows ?? [];
  const otherIds = [...new Set(requests.map((r) => (r.from_id === viewerId ? r.to_id : r.from_id)))];
  const names = new Map<string, string>();
  const avatars = new Map<string, string>();
  if (otherIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar").in("id", otherIds);
    for (const p of profiles ?? []) {
      names.set(p.id, p.username);
      avatars.set(p.id, p.avatar);
    }
  }
  const name = (id: string) => names.get(id) ?? "unknown";

  const friends: FriendEntry[] = [];
  const incoming: FriendRequestEntry[] = [];
  const outgoing: FriendRequestEntry[] = [];
  for (const r of requests) {
    const other = r.from_id === viewerId ? r.to_id : r.from_id;
    if (r.status === "accepted") friends.push({ id: other, username: name(other), avatar: avatars.get(other) ?? "initials", since: r.responded_at ?? r.created_at });
    else if (r.to_id === viewerId) incoming.push({ id: other, username: name(other), avatar: avatars.get(other) ?? "initials", at: r.created_at });
    else outgoing.push({ id: other, username: name(other), avatar: avatars.get(other) ?? "initials", at: r.created_at });
  }
  friends.sort((a, b) => a.username.localeCompare(b.username));
  return { friends, incoming, outgoing };
}
