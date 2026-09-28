/**
 * Scripted second player for testing private tables end to end.
 *
 * Signs in as the friend test account, joins a table by code over the
 * WebSocket protocol, sits down, and plays a simple check/call strategy on
 * its turns, logging what it sees. Also asserts the redaction rule: it must
 * never receive another player's hole cards before showdown.
 *
 * Usage: node scripts/table-client.mjs <CODE> [seconds]
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);

const code = process.argv[2];
const seconds = Number(process.argv[3] ?? 90);
if (!code) throw new Error("usage: node scripts/table-client.mjs <CODE> [seconds]");

const auth = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.TEST_FRIEND_EMAIL, password: env.TEST_FRIEND_PASSWORD }),
}).then((r) => r.json());
if (!auth.access_token) throw new Error(`sign-in failed: ${JSON.stringify(auth)}`);

const ws = new WebSocket(`${env.NEXT_PUBLIC_TABLE_SERVER_WS}/tables/${code}/ws?token=${encodeURIComponent(auth.access_token)}`);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let lastHand = 0;
let acted = new Set();
let leaks = 0;

ws.onopen = () => {
  log("connected; sitting down");
  ws.send(JSON.stringify({ type: "sit" }));
};
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "error") return log("server error:", msg.message);
  if (msg.type !== "view") return;
  const v = msg.view;
  const g = v.game;
  if (!g) {
    log(`lobby: ${v.seats.filter((s) => s.userId).map((s) => s.name + (s.isHost ? "*" : "")).join(", ")} | you=${v.you}`);
    return;
  }
  // Redaction check: before showdown, only my own seat may have hole cards.
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
    const action = v.legal.canCheck ? { type: "check" } : { type: "call" };
    log(`my turn (${v.turn?.decisionMs}ms clock) -> ${action.type}`);
    ws.send(JSON.stringify({ type: "act", action, hand: g.handNumber, step: v.step }));
  }
  if (g.result && g.phase !== "betting") {
    const winners = Object.keys(g.result.payouts).map((i) => g.players[i].name).join(", ");
    if (winners) log(`hand ${g.handNumber} won by ${winners}`);
  }
  if (v.phase === "finished") {
    log("game finished; leaks:", leaks);
    ws.close();
  }
};
ws.onclose = (e) => log("closed", e.code, e.reason);
setTimeout(() => {
  log(`done after ${seconds}s; leaks: ${leaks}`);
  ws.close();
}, seconds * 1000);
