import { NextResponse } from "next/server";
import { BOT_LEVELS, type BotLevel } from "@/lib/engine/bots";
import { MAX_SEATS, MODES, type ModeId } from "@/lib/engine/modes";
import type { CreateTableRequest } from "@/lib/realtime/protocol";
import { createClient, getViewer } from "@/lib/supabase/server";

/** Unambiguous characters only: no 0/O or 1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Creates a private table: a row in Supabase for the link, and the live room on the table server. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to create a table." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { mode?: string; botLevel?: string; seats?: number } | null;
  const mode = body?.mode as ModeId;
  const botLevel = (body?.botLevel ?? "medium") as BotLevel;
  const seats = Number(body?.seats ?? MODES[mode]?.seats);
  if (!(mode in MODES) || !(botLevel in BOT_LEVELS) || !Number.isInteger(seats) || seats < 2 || seats > MAX_SEATS) {
    return NextResponse.json({ error: "Invalid table settings." }, { status: 400 });
  }

  const serverUrl = process.env.TABLE_SERVER_URL;
  const secret = process.env.TABLE_SERVER_SECRET;
  if (!serverUrl || !secret) return NextResponse.json({ error: "Table server isn't configured." }, { status: 503 });

  const supabase = await createClient();
  const code = newCode();
  const { error } = await supabase.from("tables").insert({ code, host_id: viewer.id, mode, bot_level: botLevel, seats });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payload: CreateTableRequest = { config: { code, mode, hostId: viewer.id, botLevel, seats, createdAt: Date.now() } };
  const res = await fetch(`${serverUrl}/tables/${code}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "Couldn't reach the table server." }, { status: 502 });

  return NextResponse.json({ code });
}
