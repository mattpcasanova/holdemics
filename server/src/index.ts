import { activeTableOf } from "./activeGames";
import { identify } from "./auth";
import { Queue } from "./queue";
import { TableRoom } from "./table";
import { MODES } from "@/lib/engine/modes";
import type { CreateTableRequest, QueueServerMessage } from "@/lib/realtime/protocol";

export { Queue, TableRoom };

export interface Env {
  TABLES: DurableObjectNamespace<TableRoom>;
  QUEUES: DurableObjectNamespace<Queue>;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  /** Comma-separated browser origins allowed to open sockets (localhost + the deployed site). */
  ALLOWED_ORIGIN: string;
  TABLE_SERVER_SECRET: string;
}

const CODE = /^[A-Z0-9]{5,8}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Routes:
 *   POST /tables/:code/create   (app server only, bearer secret) — configure a new table
 *   GET  /tables/:code/ws?token=<supabase jwt>                   — player WebSocket
 *   GET  /tables/:code                                           — public summary (exists, phase, seats)
 *   GET  /queue/:mode/ws?token=<supabase jwt>                    — ranked matchmaking WebSocket
 */
/** Accept a socket just long enough to say why, then close it (browsers can't read a refused upgrade's body). */
function refuseSocket(msg: QueueServerMessage): Response {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.send(JSON.stringify(msg));
  server.close(4423, msg.type);
  return new Response(null, { status: 101, webSocket: client });
}

/**
 * Close codes the client acts on. A plain HTTP refusal reaches the browser as
 * an anonymous 1006 close, which looks like a network blip and gets retried
 * forever, so socket routes always upgrade and then close with one of these.
 */
const CLOSE = { unauthorized: 4401, origin: 4403, missing: 4404, refused: 4400 } as const;

function refuse(reason: keyof typeof CLOSE, message: string, context: Record<string, unknown> = {}): Response {
  console.log(JSON.stringify({ event: "socket_refused", reason, message, ...context }));
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.send(JSON.stringify({ type: "error", message }));
  server.close(CLOSE[reason], message.slice(0, 120));
  return new Response(null, { status: 101, webSocket: client });
}

function originAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return true; // non-browser clients (test scripts) send no Origin
  return env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean).includes(origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const queue = url.pathname.match(/^\/queue\/([a-z]+)\/ws$/);
    if (queue) {
      const mode = queue[1];
      if (!(mode in MODES)) return json({ error: "Bad mode" }, 400);
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket" }, 426);
      const origin = request.headers.get("Origin");
      if (!originAllowed(origin, env)) return refuse("origin", "Open Holdemics at holdemics.vercel.app to play.", { origin });
      const token = url.searchParams.get("token") ?? "";
      const who = token ? await identify(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY) : null;
      if (!who || who.anonymous) return refuse("unauthorized", "Sign in to play ranked.", { route: "queue" });
      // One game at a time: someone still in a game can't queue for another.
      const busyAt = await activeTableOf(env, who.userId);
      if (busyAt) return refuseSocket({ type: "busy", code: busyAt });
      const rating = await fetch(`${env.SUPABASE_URL}/rest/v1/ratings?user_id=eq.${who.userId}&mode=eq.${mode}&select=rating,games`, {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json() as Promise<{ rating: number; games: number }[]>)
        .then((rows) => rows[0])
        .catch(() => undefined);
      const forward = new Request(`${url.origin}/ws?mode=${mode}`, request);
      forward.headers.set("X-User-Id", who.userId);
      forward.headers.set("X-Username", who.username);
      if (who.title) forward.headers.set("X-Title", who.title);
      forward.headers.set("X-Avatar", who.avatar);
      forward.headers.set("X-Rating", String(rating?.rating ?? 1500));
      forward.headers.set("X-Games", String(rating?.games ?? 0));
      return env.QUEUES.getByName(mode).fetch(forward);
    }

    const match = url.pathname.match(/^\/tables\/([^/]+)(?:\/(create|ws))?$/);
    if (!match) return json({ error: "Not found" }, 404);
    const code = match[1].toUpperCase();
    const sub = match[2];
    if (!CODE.test(code)) return json({ error: "Bad table code" }, 400);
    const room = env.TABLES.getByName(code);

    if (sub === "create") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (request.headers.get("Authorization") !== `Bearer ${env.TABLE_SERVER_SECRET}`) return json({ error: "Forbidden" }, 403);
      const body = (await request.json()) as CreateTableRequest;
      if (body.config.code !== code) return json({ error: "Code mismatch" }, 400);
      return room.fetch(new Request(`${url.origin}/create`, { method: "POST", body: JSON.stringify(body) }));
    }

    if (sub === "ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket" }, 426);
      const origin = request.headers.get("Origin");
      if (!originAllowed(origin, env)) return refuse("origin", "Open Holdemics at holdemics.vercel.app to join tables.", { origin, code });
      const token = url.searchParams.get("token") ?? "";
      const who = token ? await identify(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY) : null;
      if (!who) return refuse("unauthorized", "Your sign-in couldn't be verified. Sign in again to join.", { code, hasToken: !!token });
      // Pass the verified identity to the room in headers; the token never reaches it.
      const forward = new Request(`${url.origin}/ws`, request);
      forward.headers.set("X-User-Id", who.userId);
      forward.headers.set("X-Username", who.username);
      if (who.title) forward.headers.set("X-Title", who.title);
      forward.headers.set("X-Avatar", who.avatar);
      // The room won't seat someone who's mid-game at another table (they can still watch).
      const busyAt = await activeTableOf(env, who.userId);
      if (busyAt && busyAt !== code) forward.headers.set("X-Busy-At", busyAt);
      forward.headers.set("X-Table-Code", code);
      const res = await room.fetch(forward);
      if (res.status === 101) return res;
      // The room said no (no such table, or a ranked table that isn't theirs): pass the reason on.
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const message = body.error ?? "Couldn't join this table.";
      return refuse(res.status === 404 ? "missing" : "refused", message, { code, user: who.userId, status: res.status });
    }

    return room.fetch(new Request(`${url.origin}/summary`));
  },
};
