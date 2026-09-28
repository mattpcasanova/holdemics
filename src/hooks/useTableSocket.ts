"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "@/lib/engine/game";
import { playEventSounds, playRunoutSounds, playYourTurn } from "@/lib/practice/sounds";
import type { ClientMessage, ServerMessage, TableView } from "@/lib/realtime/protocol";
import { createClient } from "@/lib/supabase/client";

export type SocketStatus = "connecting" | "open" | "closed" | "unauthorized" | "missing";

const PING_MS = 25_000;
const RECONNECT_MS = [1000, 2000, 4000, 8000];

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

      ws.onopen = () => {
        attempts.current = 0;
        setStatus("open");
        ping = setInterval(() => send({ type: "ping" }), PING_MS);
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "error") setError(msg.message);
        if (msg.type !== "view") return;
        cue(previous.current, msg.view);
        previous.current = msg.view;
        setView(msg.view);
      };
      ws.onclose = (event) => {
        clearInterval(ping);
        if (closedByUs.current) return;
        // 1008/4xx-style closes come from the server refusing us; don't hammer it.
        if (event.code === 1008 || event.code === 4401) {
          setStatus("unauthorized");
          return;
        }
        if (event.code === 4404) {
          setStatus("missing");
          return;
        }
        setStatus("closed");
        const delay = RECONNECT_MS[Math.min(attempts.current++, RECONNECT_MS.length - 1)];
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
  }, [code, serverWs, send]);

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
    error,
    clearError: () => setError(null),
    act,
    sit: () => send({ type: "sit" }),
    stand: () => send({ type: "stand" }),
    start: () => send({ type: "start" }),
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
