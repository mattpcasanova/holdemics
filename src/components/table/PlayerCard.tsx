"use client";

import { useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import { TagIcon } from "@/components/ui/TagIcon";
import type { PlayerState } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { PLAYER_TAGS, TAG_ORDER, noteKey, saveNote, useNotes } from "@/lib/notes";
import { type PlayerStats, EMPTY_STATS, aggressionFactor, pct } from "@/lib/stats";

interface PlayerCardProps {
  player: PlayerState;
  isHero: boolean;
  stats: PlayerStats | undefined;
  /** e.g. "Regular bot"; null for real players. */
  botLabel: string | null;
  /** Selected profile title id. */
  title?: string | null;
  avatar?: string | null;
  onClose: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-deep px-2 py-1.5" title={hint}>
      <div className="font-display text-[15px] font-semibold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-text-tertiary">{label}</div>
    </div>
  );
}

export function PlayerCard({ player, isHero, stats = EMPTY_STATS, botLabel, title, avatar, onClose }: PlayerCardProps) {
  const notes = useNotes();
  const key = noteKey(player);
  const note = notes[key];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`${isHero ? "Your" : player.name + "'s"} details`}
      onClick={(e) => e.stopPropagation()}
      className="w-[300px] rounded-2xl border border-border bg-surface-primary p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
      style={{ animation: "pop-in 160ms ease-out both" }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={player.name} avatar={avatar} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[16px] font-semibold">{isHero ? "You" : player.name}</span>
            {note?.tag && <TagIcon tag={note.tag} size={15} />}
          </div>
          {title && <PlayerTitle id={title} size={9.5} className="mb-0.5" />}
          <div className="text-[12px] text-text-tertiary">
            {botLabel ?? "Player"} · {player.eliminated ? "eliminated" : `${formatHp(player.stack)} HP`}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded-md px-1.5 text-[18px] leading-none text-text-tertiary hover:bg-white/5 hover:text-text-primary"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="text-[12px] font-medium text-text-secondary">This game</h3>
        <span className="text-[11px] text-text-tertiary">{stats.hands} hands</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Stat label="VPIP" value={pct(stats.vpip, stats.hands)} hint="Voluntarily put chips in preflop" />
        <Stat label="PFR" value={pct(stats.pfr, stats.hands)} hint="Raised preflop" />
        <Stat label="Aggression" value={aggressionFactor(stats)} hint="Postflop bets and raises per call" />
        <Stat label="Showdown" value={pct(stats.showdowns, stats.hands)} hint="Went to showdown" />
        <Stat label="Won at SD" value={pct(stats.showdownsWon, stats.showdowns)} hint="Won when reaching showdown" />
        <Stat label="Pots won" value={String(stats.handsWon)} hint="Hands won" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px]">
        <div className="rounded-lg border border-border px-2 py-1.5">
          <div className="text-text-tertiary">Rating trend</div>
          <div className="text-text-secondary">{botLabel ? "Bots are unrated" : "After ranked games"}</div>
        </div>
        <div className="rounded-lg border border-border px-2 py-1.5">
          <div className="text-text-tertiary">Played together</div>
          <div className="text-text-secondary">{botLabel ? "Bots only" : "With accounts"}</div>
        </div>
      </div>

      {!isHero && (
        <>
          <h3 className="mt-3 text-[12px] font-medium text-text-secondary">Your read</h3>
          <div role="radiogroup" aria-label="Player type" className="mt-1.5 grid grid-cols-3 gap-1.5">
            {TAG_ORDER.map((tag) => {
              const selected = note?.tag === tag;
              return (
                <button
                  key={tag}
                  role="radio"
                  aria-checked={selected}
                  title={PLAYER_TAGS[tag].hint}
                  onClick={() => saveNote(key, { tag: selected ? null : tag, note: note?.note ?? "" })}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[12px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                    selected ? "text-text-primary" : "border-border text-text-secondary hover:border-text-tertiary"
                  }`}
                  style={selected ? { borderColor: PLAYER_TAGS[tag].color, background: `${PLAYER_TAGS[tag].color}1f` } : undefined}
                >
                  <TagIcon tag={tag} />
                  {PLAYER_TAGS[tag].label}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className="text-[12px] font-medium text-text-secondary">Notes</span>
            <textarea
              value={note?.note ?? ""}
              onChange={(e) => saveNote(key, { note: e.target.value, tag: note?.tag ?? null })}
              placeholder="Limps a lot from early position…"
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-surface-deep px-2.5 py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-tertiary focus:border-gold/60"
            />
          </label>
          <p className="text-[11px] text-text-tertiary">
            Saved on this device{botLabel ? " by name" : ""}. Only you can see them.
          </p>
        </>
      )}
    </div>
  );
}
