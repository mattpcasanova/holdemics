/**
 * Scripted player for testing tables end to end.
 *
 * Signs in as one of the local test accounts, then either joins a table by
 * code or queues for a ranked match in a mode. Plays a simple strategy on its
 * turns and logs what it sees. Asserts the redaction rule: it must never
 * receive another player's hole cards before showdown.
 *
 * Usage:
 *   node scripts/table-client.mjs --as friend --code ABC123 [--strategy call|shove] [--seconds 90]
 *   node scripts/table-client.mjs --as matt --queue headsup --strategy shove
 *   node scripts/table-client.mjs --as matt --queue headsup --noshow   (match, then never connect)
 *   TABLE_WS=wss://<worker> node scripts/table-client.mjs …           (against a deployed Worker)
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
// TABLE_WS=wss://… points the script at a deployed Worker instead of the local one.
if (process.env.TABLE_WS) env.NEXT_PUBLIC_TABLE_SERVER_WS = process.env.TABLE_WS;

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const who = args.as ?? "friend";
const strategy = args.strategy ?? "call";
const seconds = Number(args.seconds ?? 120);
const creds =
  who === "matt"
    ? { email: env.TEST_ACCOUNT_EMAIL, password: env.TEST_ACCOUNT_PASSWORD }
    : { email: env.TEST_FRIEND_EMAIL, password: env.TEST_FRIEND_PASSWORD };
if (!args.code && !args.queue) throw new Error("pass --code CODE or --queue MODE");

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `[${who}]`, ...a);

const auth = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(creds),
}).then((r) => r.json());
if (!auth.access_token) throw new Error(`sign-in failed: ${JSON.stringify(auth)}`);
const token = encodeURIComponent(auth.access_token);

const deadline = setTimeout(() => {
  log(`giving up after ${seconds}s`);
  process.exit(2);
}, seconds * 1000);

const code = args.code ?? (await queue(args.queue));
if ("noshow" in args) {
  log(`matched to ${code} but not connecting (no-show test)`);
  process.exit(0);
}
await playTable(code);
clearTimeout(deadline);

/** Wait in the ranked queue until matched; resolves with the table code. */
function queue(mode) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${env.NEXT_PUBLIC_TABLE_SERVER_WS}/queue/${mode}/ws?token=${token}`);
    ws.onopen = () => log(`queued for ranked ${mode}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "queued") log(`searching: ${msg.waiting} waiting, window ±${msg.window}`);
      if (msg.type === "matched") {
        log(`matched -> table ${msg.code}`);
        resolve(msg.code);
      }
    };
    ws.onclose = (e) => e.code !== 1000 && reject(new Error(`queue closed ${e.code} ${e.reason}`));
  });
}

function playTable(code) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${env.NEXT_PUBLIC_TABLE_SERVER_WS}/tables/${code}/ws?token=${token}`);
    let lastHand = 0;
    const acted = new Set();
    let leaks = 0;

    ws.onopen = () => {
      log("connected to table; sitting down");
      ws.send(JSON.stringify({ type: "sit" }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "error") return log("server error:", msg.message);
      if (msg.type !== "view") return;
      const v = msg.view;
      const g = v.game;
      if (v.cancelled) {
        log("cancelled:", v.cancelled);
        ws.close();
        return resolve();
      }
      if (!g) {
        log(`lobby${v.config.ranked ? " (ranked)" : ""}: ${v.seats.filter((s) => s.userId).map((s) => s.name + (s.connected ? "" : "?")).join(", ")} | you=${v.you}`);
        return;
      }
      const showdown = g.result?.showdown;
      g.players.forEach((p, i) => {
        if (i !== v.you && p.holeCards.length && !showdown) {
          leaks++;
          log(`LEAK: saw ${p.name}'s cards`);
        }
      });
      if (g.handNumber !== lastHand) {
        lastHand = g.handNumber;
        log(`hand ${g.handNumber}: my cards ${g.players[v.you]?.holeCards.map((c) => c.rank + c.suit).join(" ")}`);
      }
      if (v.legal) {
        const key = `${g.handNumber}:${v.step}`;
        if (acted.has(key)) return;
        acted.add(key);
        let action;
        if (strategy === "shove" && v.legal.canRaise) action = { type: "raise", to: v.legal.maxRaiseTo };
        else action = v.legal.canCheck ? { type: "check" } : { type: "call" };
        log(`my turn -> ${action.type}${action.to ? " " + action.to : ""}`);
        ws.send(JSON.stringify({ type: "act", action, hand: g.handNumber, step: v.step }));
      }
      if (g.result && g.phase !== "betting") {
        const winners = Object.keys(g.result.payouts).map((i) => g.players[i].name).join(", ");
        if (winners) log(`hand ${g.handNumber} won by ${winners}`);
      }
      if (v.phase === "finished") {
        const me = v.seats[v.you]?.userId;
        const change = me && v.ratingChanges?.[me];
        log(`game finished; place ${g.players[v.you]?.place}; leaks: ${leaks}; rating ${change ? `${change.before} -> ${change.after}` : "pending"}`);
        if (!v.config.ranked || change) {
          ws.close();
          resolve();
        }
      }
    };
    ws.onclose = (e) => {
      log("closed", e.code, e.reason);
      resolve();
    };
  });
}
