"use client";

import type { BotLevel } from "@/lib/engine/bots";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/lib/engine/game";
import { playEventSounds, playRunoutSounds, playYourTurn } from "@/lib/practice/sounds";
import type { ClientMessage, ServerMessage, TableView } from "@/lib/realtime/protocol";
import { createClient } from "@/lib/supabase/client";

export type SocketStatus = "connecting" | "open" | "closed" | "unauthorized" | "missing" | "refused" | "unreachable";

const PING_MS = 25_000;
const RECONNECT_MS = [1000, 2000, 4000, 8000];
/** Attempts that never open before we stop and offer a Retry button instead. */
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Live connection to a table room. Keeps the latest view, reconnects with
 * backoff, and plays the same sound cues as practice by diffing hand logs
 * between views.
 */
export function useTableSocket(code: string, serverWs: string) {
  const [view, setView] = useState<TableView | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const previous = useRef<TableView | null>(null);
  const attempts = useRef(0);
  const closedByUs = useRef(false);
  const refreshedToken = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  const send = useCallback((msg: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    closedByUs.current = false;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("unauthorized");
        return;
      }
      const ws = new WebSocket(`${serverWs}/tables/${code}/ws?token=${encodeURIComponent(token)}`);
      socket.current = ws;
      setStatus("connecting");

      let opened = false;
      ws.onopen = () => {
        opened = true;
        setStatus("open");
        ping = setInterval(() => send({ type: "ping" }), PING_MS);
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "error") setError(msg.message);
        if (msg.type !== "view") return;
        // Only a view proves we're really in; a socket that opens and is closed straight away isn't.
        attempts.current = 0;
        refreshedToken.current = false;
        cue(previous.current, msg.view);
        previous.current = msg.view;
        setView(msg.view);
      };
      ws.onclose = (event) => {
        clearInterval(ping);
        if (closedByUs.current) return;
        // 4xxx closes are the server refusing us, with the reason in `event.reason`; don't hammer it.
        if (event.code === 4401 || event.code === 1008) {
          // Usually a stale access token: refresh once and try again before giving up.
          if (!refreshedToken.current) {
            refreshedToken.current = true;
            void createClient().auth.refreshSession().finally(() => {
              if (!closedByUs.current) retry = setTimeout(connect, 300);
            });
            return;
          }
          setStatus("unauthorized");
          return;
        }
        if (event.code === 4404) {
          setStatus("missing");
          return;
        }
        if (event.code === 4403 || event.code === 4400) {
          setError(event.reason || "The table server refused the connection.");
          setStatus("refused");
          return;
        }
        if (!opened || !previous.current) attempts.current++;
        if (attempts.current >= MAX_FAILED_ATTEMPTS) {
          setStatus("unreachable");
          return;
        }
        setStatus("closed");
        const delay = RECONNECT_MS[Math.min(attempts.current, RECONNECT_MS.length - 1)];
        retry = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    void connect();
    return () => {
      closedByUs.current = true;
      clearInterval(ping);
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [code, serverWs, send, retryKey]);

  const act = useCallback(
    (action: Action) => {
      const v = previous.current;
      if (!v?.game) return;
      send({ type: "act", action, hand: v.game.handNumber, step: v.step });
    },
    [send],
  );

  return {
    view,
    status,
    /** After giving up ("unreachable"), start over. */
    retry: () => {
      attempts.current = 0;
      setRetryKey((k) => k + 1);
    },
    error,
    clearError: () => setError(null),
    act,
    sit: () => send({ type: "sit" }),
    stand: () => send({ type: "stand" }),
    start: () => send({ type: "start" }),
    addBot: (level: BotLevel) => send({ type: "addBot", level }),
    kick: (seat: number, block = false) => send({ type: "kick", seat, block }),
    unblock: (userId: string) => send({ type: "unblock", userId }),
    setSeats: (seats: number) => send({ type: "setSeats", seats }),
    setMod: (userId: string, on: boolean) => send({ type: "setMod", userId, on }),
    back: () => send({ type: "back" }),
  };
}

/** Play sounds for whatever changed between two views. */
function cue(prev: TableView | null, next: TableView) {
  const g = next.game;
  if (!g) return;
  const pg = prev?.game ?? null;
  const sameHand = pg?.handNumber === g.handNumber;
  const fresh = sameHand ? g.log.slice(pg!.log.length) : g.log;
  const runoutStarted = !!next.runout && (!prev?.runout || prev.runout.hand !== next.runout.hand);

  playEventSounds(fresh, g, !!next.runout);
  if (runoutStarted && next.runout) playRunoutSounds(next.runout.from, next.runout.startedAt);
  if (next.legal && !prev?.legal) playYourTurn(g, !sameHand);
}
