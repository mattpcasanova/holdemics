import type { Metadata } from "next";
import Link from "next/link";
import { PracticeTableClient } from "@/components/table/PracticeTableClient";
import { getActiveGame } from "@/lib/activeGame";
import { BOT_LEVELS, type BotLevel } from "@/lib/engine/bots";
import { MODES, type ModeId } from "@/lib/engine/modes";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Practice table · Holdemics" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mode = (typeof params.mode === "string" && params.mode in MODES ? params.mode : "standard") as ModeId;
  const level = (typeof params.bots === "string" && params.bots in BOT_LEVELS ? params.bots : "medium") as BotLevel;
  // One game at a time, practice included.
  const viewer = await getViewer();
  const active = viewer ? await getActiveGame(viewer.id) : null;
  if (active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="font-display text-[24px] font-semibold">You&apos;re still in a game</div>
        <p className="max-w-[44ch] text-[14px] text-text-secondary">Finish your {active.ranked ? "ranked " : ""}game before starting practice. Your hands are folded while you&apos;re away.</p>
        <div className="flex gap-2">
          <Link href={`/table/${active.code}`} className="rounded-lg bg-felt px-4 py-2.5 font-display text-[14px] font-semibold text-white hover:brightness-110">
            Rejoin your game
          </Link>
          <Link href="/" className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-text-secondary hover:bg-white/5">
            Lobby
          </Link>
        </div>
      </div>
    );
  }
  return <PracticeTableClient mode={mode} level={level} />;
}
