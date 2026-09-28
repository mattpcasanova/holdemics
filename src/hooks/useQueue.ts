"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModeId } from "@/lib/engine/modes";
import type { QueueServerMessage } from "@/lib/realtime/protocol";
import { createClient } from "@/lib/supabase/client";

export type QueueState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "searching"; since: number; waiting: number; window: number }
  | { status: "matched"; code: string }
  | { status: "error"; message: string };

/** Holds a place in the ranked queue for one mode until matched or cancelled. */
export function useQueue(serverWs: string | null) {
  const router = useRouter();
  const [state, setState] = useState<QueueState>({ status: "idle" });
  const socket = useRef<WebSocket | null>(null);

  const leave = useCallback(() => {
    socket.current?.send('{"type":"leave"}');
    socket.current?.close();
    socket.current = null;
    setState({ status: "idle" });
  }, []);

  const join = useCallback(
    async (mode: ModeId) => {
      if (!serverWs) return setState({ status: "error", message: "Ranked play isn't available right now." });
      leave();
      setState({ status: "connecting" });
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setState({ status: "error", message: "Sign in to play ranked." });

      const ws = new WebSocket(`${serverWs}/queue/${mode}/ws?token=${encodeURIComponent(token)}`);
      socket.current = ws;
      const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25_000);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as QueueServerMessage;
        if (msg.type === "queued") setState({ status: "searching", since: msg.since, waiting: msg.waiting, window: msg.window });
        if (msg.type === "matched") {
          setState({ status: "matched", code: msg.code });
          router.push(`/table/${msg.code}`);
        }
      };
      ws.onclose = (e) => {
        clearInterval(ping);
        if (socket.current !== ws) return;
        socket.current = null;
        setState((s) =>
          s.status === "matched" ? s : e.code === 4409 ? { status: "error", message: "You joined the queue from another tab." } : { status: "idle" },
        );
      };
      ws.onerror = () => setState({ status: "error", message: "Couldn't reach the matchmaking server." });
    },
    [serverWs, leave, router],
  );

  useEffect(() => () => socket.current?.close(), []);

  return { state, join, leave };
}
