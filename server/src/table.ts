import { DurableObject } from "cloudflare:workers";
import { decideBotAction } from "@/lib/engine/bots";
import {
  type GameState,
  type LogEvent,
  type SeatInfo,
  alivePlayers,
  applyAction,
  createGame,
  legalActions,
  startHand,
} from "@/lib/engine/game";
import { MODES } from "@/lib/engine/modes";
import { botSeats } from "@/lib/practice/bots";
import { maskResult, runoutSchedule } from "@/lib/practice/runout";
import { DEAL_STAGGER_MS } from "@/lib/practice/timing";
import type {
  ClientMessage,
  CreateTableRequest,
  ServerMessage,
  TableConfig,
  TablePhase,
  TableView,
} from "@/lib/realtime/protocol";
import { redactGame } from "@/lib/realtime/view";
import { ratingChanges } from "@/lib/rating";
import { type GameFacts, type PlayerTotals, gameAchievements, milestoneAchievements } from "@/lib/achievements";
import { STARTING_STACK } from "@/lib/engine/modes";
import type { Env } from "./index";

/**
 * One private table. Holds the engine state, seats players and bots, runs the
 * decision clock and bot turns on alarms, and sends each connection a view
 * with everyone else's hole cards removed.
 *
 * All state lives in `this.state` and is written to storage after every
 * transition, so the object can hibernate between events.
 */

interface Seat {
  userId: string | null;
  name: string;
  isBot: boolean;
  sittingOut: boolean;
  bankMs: number;
}

/** What the next alarm should do. */
type Due =
  | { kind: "bot"; at: number }
  | { kind: "clock"; at: number }
  | { kind: "sitout"; at: number }
  | { kind: "handEnd"; at: number }
  | { kind: "runout"; at: number }
  | { kind: "deal"; at: number }
  /** Ranked: everyone must connect before this, or the match is called off. */
  | { kind: "startTimeout"; at: number };

interface TableState {
  config: TableConfig;
  phase: TablePhase;
  seats: Seat[];
  game: GameState | null;
  /** Epoch ms when the current decision started (for the clock). */
  turnStartedAt: number | null;
  runout: { hand: number; from: number; startedAt: number } | null;
  history: { hand: number; events: LogEvent[] }[];
  /** Increments on every game transition; clients echo it so stale actions are ignored. */
  step: number;
  due: Due | null;
  ratingChanges?: Record<string, { before: number; after: number }>;
  cancelled?: string;
  /** Per-seat facts gathered over the game for achievements. */
  facts?: Record<number, SeatFacts>;
  achievements?: Record<string, string[]>;
}

/** What we track per seat during a game; turned into GameFacts at the end. */
interface SeatFacts {
  minStack: number;
  ledFromFinalFour: boolean;
  knockouts: number;
  worstShowdownLoss: number | null;
  survivedAllIn: boolean;
}

const freshFacts = (): SeatFacts => ({ minStack: STARTING_STACK, ledFromFinalFour: true, knockouts: 0, worstShowdownLoss: null, survivedAllIn: false });

const RANKED_START_TIMEOUT_MS = 30_000;

interface Attachment {
  userId: string;
  username: string;
}

const PACE = { botMin: 650, botMax: 1500, handEnd: 1600, showdownEnd: 3200, firstDeal: 900 };
const SITOUT_ACT_MS = 500;
const HISTORY_LIMIT = 12;

export class TableRoom extends DurableObject<Env> {
  private state: TableState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<TableState>("table")) ?? null;
    });
  }

  // ─── HTTP entry points (from the Worker router) ──────────

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path === "/create") {
      const { config } = (await request.json()) as CreateTableRequest;
      if (this.state) return Response.json({ error: "Table already exists" }, { status: 409 });
      const seats = config.ranked ? MODES[config.mode].seats : config.seats;
      if (!Number.isInteger(seats) || seats < 2 || seats > 9) return Response.json({ error: "Tables seat 2–9 players" }, { status: 400 });
      const ranked = !!config.ranked && !!config.players;
      if (ranked && config.players!.length !== seats) return Response.json({ error: "Ranked tables must be full" }, { status: 400 });
      this.state = {
        config,
        phase: "lobby",
        seats: Array.from({ length: seats }, (_, i) => {
          const p = ranked ? config.players![i] : null;
          return { userId: p?.userId ?? null, name: p?.name ?? "", isBot: false, sittingOut: false, bankMs: 0 };
        }),
        game: null,
        turnStartedAt: null,
        runout: null,
        history: [],
        step: 0,
        due: ranked ? { kind: "startTimeout", at: Date.now() + RANKED_START_TIMEOUT_MS } : null,
      };
      await this.save();
      return Response.json({ ok: true });
    }

    if (path === "/summary") {
      if (!this.state) return Response.json({ error: "No such table" }, { status: 404 });
      const s = this.state;
      return Response.json({
        code: s.config.code,
        mode: s.config.mode,
        phase: s.phase,
        seated: s.seats.filter((x) => x.userId || x.isBot).length,
        seats: s.seats.length,
      });
    }

    if (path === "/ws") {
      if (!this.state) return Response.json({ error: "No such table" }, { status: 404 });
      const attachment: Attachment = {
        userId: request.headers.get("X-User-Id")!,
        username: request.headers.get("X-Username")!,
      };
      // Ranked tables are for the matched players only.
      if (this.state.config.ranked && !this.state.seats.some((s) => s.userId === attachment.userId)) {
        return Response.json({ error: "This ranked table isn't yours" }, { status: 403 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);
      // Ranked: the game starts itself once every matched player has connected.
      if (this.state.config.ranked && this.state.phase === "lobby" && this.state.seats.every((s) => s.userId && this.isConnected(s.userId))) {
        this.startGame();
        await this.save();
      }
      // A returning player keeps their seat; just refresh everyone's view.
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ─── WebSocket handlers ──────────────────────────────────

  async webSocketMessage(ws: WebSocket, raw: ArrayBuffer | string) {
    if (!this.state || typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const who = ws.deserializeAttachment() as Attachment;
    const seat = this.state.seats.findIndex((s) => s.userId === who.userId);

    switch (msg.type) {
      case "ping":
        this.send(ws, { type: "pong" });
        return;
      case "sit":
        if (this.state.config.ranked) return;
        this.sit(who);
        break;
      case "stand":
        if (this.state.config.ranked) return;
        this.stand(who);
        break;
      case "start":
        if (this.state.config.ranked) return;
        if (who.userId !== this.state.config.hostId) return this.send(ws, { type: "error", message: "Only the host can start the game." });
        if (!this.startGame(msg.bots ?? 0)) return this.send(ws, { type: "error", message: "A game needs at least two players. Add a bot or wait for a friend." });
        break;
      case "back":
        if (seat >= 0) this.state.seats[seat].sittingOut = false;
        break;
      case "act": {
        const g = this.state.game;
        if (!g || g.phase !== "betting" || seat < 0 || g.toAct !== seat) return;
        if (msg.hand !== g.handNumber || msg.step !== this.state.step) return; // stale
        const legal = legalActions(g);
        if (!legal) return;
        try {
          this.chargeTimeBank(seat);
          this.transition(applyAction(g, msg.action));
          return;
        } catch (e) {
          return this.send(ws, { type: "error", message: e instanceof Error ? e.message : "Illegal action" });
        }
      }
    }
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
    // In the lobby a player who leaves frees their seat; mid-game the seat is kept.
    if (this.state?.phase === "lobby" && !this.state.config.ranked) {
      const who = ws.deserializeAttachment() as Attachment | null;
      if (who && !this.isConnected(who.userId, ws)) this.stand(who);
    }
    await this.save();
    this.broadcast();
  }

  async webSocketError(ws: WebSocket) {
    ws.close(1011, "error");
  }

  // ─── Alarms drive everything the players don't ──────────

  async alarm() {
    const s = this.state;
    if (!s?.due) return;
    const due = s.due;
    s.due = null;

    if (due.kind === "startTimeout") {
      if (s.phase === "lobby") {
        s.phase = "finished";
        s.cancelled = "A player didn't show up, so the match was called off. No rating change.";
        await this.save();
        this.broadcast();
      }
      return;
    }

    if (!s.game) return;
    const g = s.game;

    switch (due.kind) {
      case "deal":
      case "handEnd":
        if (g.phase !== "finished") this.transition(startHand(g));
        break;
      case "runout":
        s.runout = null;
        this.noteHandEnd(g);
        this.pushHistory(g);
        this.scheduleAfterHand(g);
        await this.save();
        this.broadcast();
        break;
      case "bot":
        if (g.phase === "betting" && g.toAct !== null && s.seats[g.toAct].isBot) {
          this.transition(applyAction(g, decideBotAction(g, s.config.botLevel)));
        }
        break;
      case "sitout":
      case "clock":
        if (g.phase === "betting" && g.toAct !== null) {
          const seat = s.seats[g.toAct];
          const legal = legalActions(g);
          if (legal) {
            if (due.kind === "clock") {
              seat.bankMs = 0;
              seat.sittingOut = true;
            }
            this.transition(applyAction(g, { type: legal.canCheck ? "check" : "fold" }));
          }
        }
        break;
    }
    await this.pendingRanked;
  }

  private pendingRanked: Promise<void> | null = null;

  // ─── Lobby ───────────────────────────────────────────────

  private sit(who: Attachment) {
    const s = this.state!;
    if (s.phase !== "lobby") return;
    if (s.seats.some((x) => x.userId === who.userId)) return;
    const empty = s.seats.findIndex((x) => !x.userId && !x.isBot);
    if (empty < 0) return;
    s.seats[empty] = { userId: who.userId, name: who.username, isBot: false, sittingOut: false, bankMs: 0 };
  }

  private stand(who: Attachment) {
    const s = this.state!;
    if (s.phase !== "lobby") return;
    const i = s.seats.findIndex((x) => x.userId === who.userId);
    if (i >= 0) s.seats[i] = { userId: null, name: "", isBot: false, sittingOut: false, bankMs: 0 };
  }

  /**
   * Start with the seated humans plus `botCount` bots (ranked: everyone is
   * seated already and no bots are added). Empty seats beyond that are
   * removed so the game has exactly the players at the table.
   */
  private startGame(botCount = 0): boolean {
    const s = this.state!;
    if (s.phase !== "lobby") return false;
    const humans = s.seats.filter((x) => x.userId);
    if (humans.length === 0) return false;

    const open = s.seats.filter((x) => !x.userId).length;
    const bots = s.config.ranked ? [] : botSeats(Math.max(0, Math.min(botCount, open)), s.config.botLevel);
    let b = 0;
    for (const seat of s.seats) {
      if (seat.userId || b >= bots.length) continue;
      const bot = bots[b++];
      seat.isBot = true;
      seat.name = bot.name;
      seat.userId = null;
    }
    // Drop empty seats; players keep their relative order around the table.
    s.seats = s.seats.filter((x) => x.userId || x.isBot);
    if (s.seats.length < 2) {
      for (const seat of s.seats) if (seat.isBot) Object.assign(seat, { isBot: false, name: "" });
      s.seats = Array.from({ length: s.config.ranked ? MODES[s.config.mode].seats : s.config.seats }, (_, i) => s.seats[i] ?? { userId: null, name: "", isBot: false, sittingOut: false, bankMs: 0 });
      return false;
    }
    const seats: SeatInfo[] = s.seats.map((seat, i) => ({ id: seat.userId ?? `bot-${i}`, name: seat.name, isBot: seat.isBot }));
    const bank = MODES[s.config.mode].timeBankSeconds * 1000;
    for (const seat of s.seats) seat.bankMs = seat.isBot ? 0 : bank;

    const seed = Math.floor(Math.random() * 2 ** 31);
    s.game = createGame({ mode: s.config.mode, seats, seed });
    s.facts = Object.fromEntries(s.seats.map((_, i) => [i, freshFacts()]));
    return true;
    s.phase = "playing";
    s.step++;
    s.due = { kind: "deal", at: Date.now() + PACE.firstDeal };
    return true;
  }

  // ─── Game transitions ────────────────────────────────────

  /** Apply a new engine state, then work out what happens next and when. */
  private transition(next: GameState) {
    const s = this.state!;
    const prev = s.game;
    s.game = next;
    s.step++;
    s.turnStartedAt = next.phase === "betting" ? Date.now() : null;

    const sameHand = prev?.handNumber === next.handNumber;
    const isRunout = !!next.result?.showdown && !!prev && sameHand && next.board.length > prev.board.length;

    if (!sameHand) this.noteHandStart(next);
    if (next.result && !isRunout) this.noteHandEnd(next);

    if (isRunout) {
      s.runout = { hand: next.handNumber, from: prev.board.length, startedAt: Date.now() };
      s.due = { kind: "runout", at: Date.now() + runoutSchedule(prev.board.length).doneAt };
    } else if (next.phase === "betting") {
      this.pushHistory(next);
      this.scheduleTurn(next);
    } else {
      this.pushHistory(next);
      this.scheduleAfterHand(next);
    }

    void this.save();
    this.broadcast();
  }

  private scheduleTurn(g: GameState) {
    const s = this.state!;
    const seat = s.seats[g.toAct!];
    const mode = MODES[s.config.mode];
    // Wait out the deal animation before the first action of a hand.
    const dealing = g.log.length <= 4 ? alivePlayers(g).length * 2 * DEAL_STAGGER_MS : 0;
    if (seat.isBot) {
      s.due = { kind: "bot", at: Date.now() + dealing + PACE.botMin + Math.random() * (PACE.botMax - PACE.botMin) };
    } else if (seat.sittingOut) {
      s.due = { kind: "sitout", at: Date.now() + dealing + SITOUT_ACT_MS };
    } else {
      s.due = { kind: "clock", at: Date.now() + dealing + mode.decisionSeconds * 1000 + seat.bankMs };
    }
  }

  private scheduleAfterHand(g: GameState) {
    const s = this.state!;
    if (g.phase === "finished") {
      s.phase = "finished";
      s.due = null;
      if (s.config.ranked) this.pendingRanked = this.recordRanked(g);
      else if (!s.seats.some((x) => x.isBot)) this.pendingRanked = this.awardGameAchievements(g, {});
      return;
    }
    s.due = { kind: "handEnd", at: Date.now() + (g.result?.showdown ? PACE.showdownEnd : PACE.handEnd) };
  }

  /** Time used beyond the decision clock comes out of the player's bank. */
  private chargeTimeBank(seat: number) {
    const s = this.state!;
    if (s.turnStartedAt === null) return;
    const overtime = Date.now() - s.turnStartedAt - MODES[s.config.mode].decisionSeconds * 1000;
    if (overtime > 0) s.seats[seat].bankMs = Math.max(0, s.seats[seat].bankMs - overtime);
  }

  private pushHistory(g: GameState) {
    const s = this.state!;
    const rest = s.history.length && s.history[s.history.length - 1].hand === g.handNumber ? s.history.slice(0, -1) : s.history;
    s.history = [...rest, { hand: g.handNumber, events: g.log }].slice(-HISTORY_LIMIT);
  }

  // ─── Ranked results ──────────────────────────────────────

  /**
   * Pairwise Elo over the finishing places, written with the service role:
   * new ratings (and peak/games) plus one ranked_games row per player.
   */
  private async recordRanked(g: GameState) {
    const s = this.state!;
    const players = s.config.players ?? [];
    const entries = players.map((p) => {
      const seat = s.seats.findIndex((x) => x.userId === p.userId);
      return { id: p.userId, rating: p.rating, gamesPlayed: p.games, place: g.players[seat]?.place ?? players.length };
    });
    const deltas = ratingChanges(entries, s.config.mode);
    const changes: Record<string, { before: number; after: number }> = {};
    for (const e of entries) changes[e.id] = { before: e.rating, after: e.rating + (deltas[e.id] ?? 0) };

    // Written through a guarded database function, so the server needs no privileged key.
    try {
      const res = await fetch(`${this.env.SUPABASE_URL}/rest/v1/rpc/record_ranked_result`, {
        method: "POST",
        headers: {
          apikey: this.env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${this.env.SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_secret: this.env.TABLE_SERVER_SECRET,
          p_code: s.config.code,
          p_mode: s.config.mode,
          p_results: entries.map((e) => ({
            user_id: e.id,
            place: e.place,
            players: entries.length,
            hands: g.handNumber,
            rating_before: e.rating,
            rating_after: changes[e.id].after,
          })),
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      s.ratingChanges = changes;
      const totals = (await res.json()) as Record<string, { games: number; wins: number; headsup_wins: number; rating: number; rank: number | null }>;
      const byUser: Record<string, PlayerTotals> = {};
      for (const [uid, t] of Object.entries(totals)) {
        byUser[uid] = { rankedGames: t.games, rankedWins: t.wins, headsUpWins: t.headsup_wins, rating: t.rating, rank: t.rank };
      }
      await this.awardGameAchievements(g, byUser);
    } catch (err) {
      console.error("ranked write failed", err);
      s.cancelled = "Ratings couldn't be saved for this game. It won't count.";
    }
    await this.save();
    this.broadcast();
  }

  // ─── Achievements ────────────────────────────────────────

  /** At each hand start: lowest stack so far, and chip-leader status once four remain. */
  private noteHandStart(g: GameState) {
    const facts = this.state!.facts;
    if (!facts) return;
    // Blinds are already posted when a hand starts, so count committed chips as still theirs.
    const held = (p: GameState["players"][number]) => p.stack + p.totalBet;
    const alive = g.players.filter((p) => !p.eliminated);
    const top = Math.max(...alive.map(held));
    const leaders = alive.filter((p) => held(p) === top).length;
    g.players.forEach((p, i) => {
      const f = facts[i];
      if (!f || p.eliminated) return;
      f.minStack = Math.min(f.minStack, held(p));
      if (alive.length <= 4 && !(held(p) === top && leaders === 1)) f.ledFromFinalFour = false;
    });
  }

  /** At each hand end: knockouts, showdown losses with big hands, all-ins survived. */
  private noteHandEnd(g: GameState) {
    const facts = this.state!.facts;
    const r = g.result;
    if (!facts || !r) return;
    const payouts = Object.entries(r.payouts).map(([i, amt]) => ({ i: Number(i), amt }));
    const biggestWinner = payouts.sort((a, b) => b.amt - a.amt)[0]?.i;
    if (biggestWinner !== undefined && facts[biggestWinner]) facts[biggestWinner].knockouts += r.busted.length;
    if (r.showdown) {
      for (const [i, hand] of Object.entries(r.hands)) {
        const seat = Number(i);
        const f = facts[seat];
        if (!f) continue;
        const won = (r.payouts[seat] ?? 0) > 0;
        if (!won) f.worstShowdownLoss = Math.max(f.worstShowdownLoss ?? -1, hand.value.category);
        else if (g.players[seat].allIn) f.survivedAllIn = true;
      }
    }
  }

  /** Evaluate the rules for every human seat and record what's new. */
  private async awardGameAchievements(g: GameState, totals: Record<string, PlayerTotals>) {
    const s = this.state!;
    if (!s.facts) return;
    const awards: { user_id: string; achievement_id: string }[] = [];
    s.seats.forEach((seat, i) => {
      if (!seat.userId || !s.facts![i]) return;
      const f = s.facts![i];
      const gf: GameFacts = {
        mode: s.config.mode,
        ranked: !!s.config.ranked,
        players: s.seats.length,
        place: g.players[i].place ?? s.seats.length,
        handsPlayed: g.handNumber,
        minStack: f.minStack,
        ledFromFinalFour: f.ledFromFinalFour,
        knockouts: f.knockouts,
        worstShowdownLoss: f.worstShowdownLoss,
        survivedAllIn: f.survivedAllIn,
      };
      const ids = new Set(gameAchievements(gf));
      const t = totals[seat.userId];
      if (t) for (const id of milestoneAchievements(t, s.config.mode)) ids.add(id);
      for (const id of ids) awards.push({ user_id: seat.userId, achievement_id: id });
    });
    if (!awards.length) return;
    try {
      const res = await fetch(`${this.env.SUPABASE_URL}/rest/v1/rpc/award_achievements`, {
        method: "POST",
        headers: {
          apikey: this.env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${this.env.SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_secret: this.env.TABLE_SERVER_SECRET, p_code: s.config.code, p_awards: awards }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const fresh = (await res.json()) as Record<string, string[]>;
      if (Object.keys(fresh).length) s.achievements = fresh;
    } catch (err) {
      console.error("achievement write failed", err);
    }
    await this.save();
    this.broadcast();
  }

  // ─── Views and I/O ───────────────────────────────────────

  private viewFor(who: Attachment): TableView {
    const s = this.state!;
    const you = s.seats.findIndex((x) => x.userId === who.userId);
    const viewer = you >= 0 ? you : null;
    const full = s.game;
    const masked = full && s.runout ? maskResult(full) : full;
    const game = masked ? redactGame(masked, viewer) : null;
    const mode = MODES[s.config.mode];
    const yourTurn = full?.phase === "betting" && viewer !== null && full.toAct === viewer && !s.runout;

    return {
      config: s.config,
      phase: s.phase,
      seats: s.seats.map((seat, index) => ({
        index,
        userId: seat.userId,
        name: seat.name,
        isBot: seat.isBot,
        connected: seat.isBot || (seat.userId !== null && this.isConnected(seat.userId)),
        isHost: seat.userId === s.config.hostId,
        sittingOut: seat.sittingOut,
      })),
      game,
      you: viewer,
      legal: yourTurn && !s.seats[viewer].sittingOut ? legalActions(full) : null,
      turn:
        full?.phase === "betting" && full.toAct !== null && s.turnStartedAt !== null && !s.runout
          ? {
              player: full.toAct,
              startedAt: s.turnStartedAt,
              decisionMs: mode.decisionSeconds * 1000,
              bankMs: viewer === full.toAct ? s.seats[viewer].bankMs : 0,
            }
          : null,
      runout: s.runout,
      history: s.history,
      step: s.step,
      ratingChanges: s.ratingChanges,
      cancelled: s.cancelled,
      achievements: s.achievements,
    };
  }

  private broadcast() {
    if (!this.state) return;
    for (const ws of this.ctx.getWebSockets()) {
      const who = ws.deserializeAttachment() as Attachment | null;
      if (!who) continue;
      this.send(ws, { type: "view", view: this.viewFor(who) });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket already gone; its close handler cleans up.
    }
  }

  private isConnected(userId: string, except?: WebSocket): boolean {
    return this.ctx.getWebSockets().some((ws) => ws !== except && (ws.deserializeAttachment() as Attachment | null)?.userId === userId);
  }

  private async save() {
    if (!this.state) return;
    await this.ctx.storage.put("table", this.state);
    const at = this.state.due?.at;
    if (at !== undefined) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
  }
}
