/**
 * Joins presence as the friend test account so online status and table
 * invites can be tested against a real second player. Accepts any pending
 * friend requests first. Logs invites it receives (via Postgres Changes on
 * table_invites) and, with --accept-invite, joins the invited table.
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

const { data: pending } = await supabase.from("friend_requests").select("from_id").eq("to_id", me.id).eq("status", "pending");
for (const r of pending ?? []) {
  const { error: e } = await supabase.from("friend_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("from_id", r.from_id).eq("to_id", me.id);
  log(e ? `accept failed: ${e.message}` : `accepted request from ${r.from_id}`);
}

await supabase.realtime.setAuth();

const presence = supabase.channel("holdemics:presence", { config: { private: true, presence: { key: me.id } } });
presence
  .on("presence", { event: "sync" }, () => {
    const who = Object.values(presence.presenceState())
      .flat()
      .map((p) => `${p.username}@${p.where}`);
    log(`online: ${[...new Set(who)].join(", ")}`);
  })
  .subscribe(async (status, err) => {
    log(`presence ${status}${err ? " " + err.message : ""}`);
    if (status === "SUBSCRIBED") await presence.track({ userId: me.id, username: profile.username, where: "lobby" });
  });

const invites = supabase
  .channel(`invites:${me.id}`, { config: { private: true } })
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "table_invites", filter: `to_id=eq.${me.id}` }, async ({ new: row }) => {
    const { data: from } = await supabase.from("profiles").select("username").eq("id", row.from_id).maybeSingle();
    log(`INVITE from ${from?.username ?? row.from_id} to table ${row.code} (${row.mode})`);
  })
  .subscribe((status, err) => log(`invites ${status}${err ? " " + err.message : ""}`));

// Negative test: try to forge an invite from someone else; RLS must refuse it.
const { error: forge } = await supabase.from("table_invites").insert({ from_id: "00000000-0000-0000-0000-000000000000", to_id: me.id, code: "FORGED", mode: "headsup" });
log(`forged invite ${forge ? "refused: " + forge.code : "ACCEPTED (bug!)"}`);

setTimeout(async () => {
  await supabase.removeChannel(presence);
  await supabase.removeChannel(invites);
  log("done");
  process.exit(0);
}, seconds * 1000);
