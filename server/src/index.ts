import { identify } from "./auth";
import { Queue } from "./queue";
import { TableRoom } from "./table";
import { MODES } from "@/lib/engine/modes";
import type { CreateTableRequest } from "@/lib/realtime/protocol";

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
      if (!originAllowed(origin, env)) return json({ error: "Origin not allowed" }, 403);
      const token = url.searchParams.get("token") ?? "";
      const who = token ? await identify(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY) : null;
      if (!who || who.anonymous) return json({ error: "Sign in to play ranked" }, 401);
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
      if (!originAllowed(origin, env)) return json({ error: "Origin not allowed" }, 403);
      const token = url.searchParams.get("token") ?? "";
      const who = token ? await identify(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY) : null;
      if (!who) return json({ error: "Sign in to join a table" }, 401);
      // Pass the verified identity to the room in headers; the token never reaches it.
      const forward = new Request(`${url.origin}/ws`, request);
      forward.headers.set("X-User-Id", who.userId);
      forward.headers.set("X-Username", who.username);
      if (who.title) forward.headers.set("X-Title", who.title);
      forward.headers.set("X-Avatar", who.avatar);
      return room.fetch(forward);
    }

    return room.fetch(new Request(`${url.origin}/summary`));
  },
};
