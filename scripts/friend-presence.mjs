/**
 * Joins the presence channel as the friend test account so online status
 * and table invites can be tested against a real second player. Accepts
 * any pending friend requests first. Logs invites it receives.
 *
 * Usage: node scripts/friend-presence.mjs [seconds]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
const seconds = Number(process.argv[2] ?? 120);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), "[friend]", ...a);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase.auth.signInWithPassword({ email: env.TEST_FRIEND_EMAIL, password: env.TEST_FRIEND_PASSWORD });
if (error) throw error;
const me = data.user;
const { data: profile } = await supabase.from("profiles").select("username").eq("id", me.id).single();
log(`signed in as ${profile.username}`);

// Accept anything pending for us.
const { data: pending } = await supabase.from("friend_requests").select("from_id").eq("to_id", me.id).eq("status", "pending");
for (const r of pending ?? []) {
  const { error: e } = await supabase.from("friend_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("from_id", r.from_id).eq("to_id", me.id);
  log(e ? `accept failed: ${e.message}` : `accepted request from ${r.from_id}`);
}

const channel = supabase.channel("holdemics:presence", { config: { presence: { key: me.id } } });
channel
  .on("presence", { event: "sync" }, () => {
    const who = Object.values(channel.presenceState())
      .flat()
      .map((p) => `${p.username}@${p.where}`);
    log(`online: ${who.join(", ")}`);
  })
  .on("broadcast", { event: "invite" }, ({ payload }) => {
    if (payload.to === me.id) log(`INVITE from ${payload.fromName} to table ${payload.code} (${payload.mode})`);
  })
  .subscribe(async (status, err) => {
    log(`channel ${status}${err ? " " + err.message : ""}`);
    if (status === "SUBSCRIBED") await channel.track({ userId: me.id, username: profile.username, where: "lobby" });
  });

setTimeout(async () => {
  await supabase.removeChannel(channel);
  log("done");
  process.exit(0);
}, seconds * 1000);
