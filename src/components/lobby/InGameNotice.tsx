"use client";

import Link from "next/link";
import { useActiveGame } from "@/lib/presence";

/** One line explaining why a "play" control is off: you're still in a game. Renders nothing otherwise. */
export function InGameNotice({ className = "" }: { className?: string }) {
  const game = useActiveGame();
  if (!game) return null;
  return (
    <p className={`text-[12px] text-text-secondary ${className}`}>
      One game at a time.{" "}
      <Link href={`/table/${game.code}`} className="font-medium text-felt-light hover:underline">
        Rejoin your game
      </Link>{" "}
      to finish it first.
    </p>
  );
}
