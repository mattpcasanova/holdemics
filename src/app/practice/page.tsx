import type { Metadata } from "next";
import { PracticeTableClient } from "@/components/table/PracticeTableClient";
import { BOT_LEVELS, type BotLevel } from "@/lib/engine/bots";
import { MODES, type ModeId } from "@/lib/engine/modes";

export const metadata: Metadata = { title: "Practice table · Holdemics" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mode = (typeof params.mode === "string" && params.mode in MODES ? params.mode : "standard") as ModeId;
  const level = (typeof params.bots === "string" && params.bots in BOT_LEVELS ? params.bots : "medium") as BotLevel;
  return <PracticeTableClient mode={mode} level={level} />;
}
