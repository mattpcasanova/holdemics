import { DurableObject } from "cloudflare:workers";
import { MODES, type ModeId } from "@/lib/engine/modes";
import type { CreateTableRequest, QueueServerMessage, RankedPlayer } from "@/lib/realtime/protocol";
import type { Env } from "./index";

/**
 * The ranked queue for one mode. Players hold a WebSocket open while they
 * wait; the pool is just the open sockets and their attachments, so nothing
 * needs storing. Every few seconds, and whenever someone joins, it looks for
 * a group of `seats` players whose ratings all fall inside each other's
 * windows, creates a locked ranked table for them, and sends them its code.
 */

interface Waiting extends RankedPlayer {
  joinedAt: number;
}

const SWEEP_MS = 3000;
const BASE_WINDOW = 100;
const WINDOW_STEP = 50;
const WINDOW_EVERY_MS = 10_000;
const MAX_WINDOW = 600;

/** How far from their own rating a player will accept, growing with wait time. */
function windowFor(p: Waiting, now: number): number {
  return Math.min(MAX_WINDOW, BASE_WINDOW + WINDOW_STEP * Math.floor((now - p.joinedAt) / WINDOW_EVERY_MS));
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export class Queue extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") return Response.json({ error: "Not found" }, { status: 404 });
    const mode = url.searchParams.get("mode") as ModeId;
    if (!(mode in MODES)) return Response.json({ error: "Bad mode" }, { status: 400 });

    const player: Waiting = {
      userId: request.headers.get("X-User-Id")!,
      name: request.headers.get("X-Username")!,
      title: request.headers.get("X-Title") || null,
      avatar: request.headers.get("X-Avatar") || "initials",
      rating: Number(request.headers.get("X-Rating")),
      games: Number(request.headers.get("X-Games")),
      joinedAt: Date.now(),
    };

    // One queue slot per player: a second tab replaces the first.
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Waiting).userId === player.userId) ws.close(4409, "Queued elsewhere");
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ ...player, mode });
    await this.ctx.storage.put("mode", mode);

    await this.match(mode);
    this.broadcastStatus();
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: ArrayBuffer | string) {
    if (raw === '{"type":"leave"}') ws.close(1000, "left");
    else if (raw === '{"type":"ping"}') ws.send('{"type":"pong"}');
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
    this.broadcastStatus();
  }

  async alarm() {
    const mode = (await this.ctx.storage.get<ModeId>("mode")) ?? "headsup";
    await this.match(mode);
    this.broadcastStatus();
    if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
  }

  private pool(): { ws: WebSocket; p: Waiting }[] {
    return this.ctx.getWebSockets().map((ws) => ({ ws, p: ws.deserializeAttachment() as Waiting }));
  }

  private broadcastStatus() {
    const pool = this.pool();
    const now = Date.now();
    for (const { ws, p } of pool) {
      const msg: QueueServerMessage = { type: "queued", waiting: pool.length, since: p.joinedAt, window: windowFor(p, now) };
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // gone
      }
    }
  }

  /** Form as many full tables as the pool allows, longest-waiting players first. */
  private async match(mode: ModeId) {
    const seats = MODES[mode].seats;
    const now = Date.now();
    let pool = this.pool().sort((a, b) => a.p.joinedAt - b.p.joinedAt);

    while (pool.length >= seats) {
      const anchor = pool[0];
      // Everyone who can accept the anchor's rating and whose rating the anchor accepts.
      const group = pool
        .filter(({ p }) => {
          const gap = Math.abs(p.rating - anchor.p.rating);
          return gap <= windowFor(p, now) && gap <= windowFor(anchor.p, now);
        })
        .slice(0, seats);
      if (group.length < seats) {
        // The anchor can't be seated yet; try the next-longest waiter as anchor.
        pool = pool.slice(1);
        continue;
      }
      await this.createTable(mode, seats, group);
      const seated = new Set(group.map((g) => g.p.userId));
      pool = pool.filter(({ p }) => !seated.has(p.userId));
    }
  }

  private async createTable(mode: ModeId, seats: number, group: { ws: WebSocket; p: Waiting }[]) {
    const code = newCode();
    const players: RankedPlayer[] = group.map(({ p }) => ({ userId: p.userId, name: p.name, title: p.title, avatar: p.avatar, rating: p.rating, games: p.games }));
    const body: CreateTableRequest = {
      config: { code, mode, hostId: players[0].userId, botLevel: "medium", seats, createdAt: Date.now(), ranked: true, players },
    };
    const room = this.env.TABLES.getByName(code);
    const res = await room.fetch(new Request("https://table/create", { method: "POST", body: JSON.stringify(body) }));
    if (!res.ok) return;
    const msg: QueueServerMessage = { type: "matched", code };
    for (const { ws } of group) {
      try {
        ws.send(JSON.stringify(msg));
        ws.close(1000, "matched");
      } catch {
        // gone; the table's start timeout handles no-shows
      }
    }
  }
}
