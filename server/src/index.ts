import { identify } from "./auth";
import { TableRoom } from "./table";
import type { CreateTableRequest } from "@/lib/realtime/protocol";

export { TableRoom };

export interface Env {
  TABLES: DurableObjectNamespace<TableRoom>;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
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
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
      if (origin && origin !== env.ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
      const token = url.searchParams.get("token") ?? "";
      const who = token ? await identify(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY) : null;
      if (!who) return json({ error: "Sign in to join a table" }, 401);
      // Pass the verified identity to the room in headers; the token never reaches it.
      const forward = new Request(`${url.origin}/ws`, request);
      forward.headers.set("X-User-Id", who.userId);
      forward.headers.set("X-Username", who.username);
      return room.fetch(forward);
    }

    return room.fetch(new Request(`${url.origin}/summary`));
  },
};
