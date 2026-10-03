"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChipIcon } from "@/components/table/ChipStack";
import { PlayingCard } from "@/components/table/PlayingCard";
import { play } from "@/lib/audio";
import { SpeakerIcon } from "./SoundToggle";
import { TablePreview } from "@/components/ui/RewardPreview";
import { PlayerTitle } from "./PlayerTitle";
import { ACHIEVEMENT_BY_ID } from "@/lib/achievements";
import { Avatar } from "./Avatar";
import { AVATARS, CARD_BACKS, CHIP_SETS, RARITY, TABLE_SKINS, TITLES, ownedCosmetics } from "@/lib/cosmetics";
import type { Card } from "@/lib/engine/cards";
import { type DeckStyle, settingsStore, useSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";
import { unlocksStore, useUnlocks } from "@/lib/unlocks";

const SAMPLE: Card[] = [
  { rank: 14, suit: "s" },
  { rank: 13, suit: "h" },
  { rank: 12, suit: "d" },
  { rank: 11, suit: "c" },
];

const DECK_STYLES: { id: DeckStyle; name: string; hint: string }[] = [
  { id: "two-color", name: "Two-color", hint: "Classic red and black" },
  { id: "four-color", name: "Four-color", hint: "Each suit has its own ink" },
  { id: "full-color", name: "Full-color", hint: "Whole card tinted by suit" },
];

export function SettingsButton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} aria-haspopup="dialog">
        {children ?? "Settings"}
      </button>
      {/* Portal out of any sticky/transformed ancestor so the dialog layers above the page. */}
      {open && createPortal(<SettingsDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Option({
  selected,
  onSelect,
  children,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={`flex flex-col justify-start rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
        selected ? "border-gold/70 bg-gold/[0.06]" : "border-border bg-surface-deep hover:border-text-tertiary"
      }`}
    >
      {children}
    </button>
  );
}

function unlockHint(achievementId: string | undefined): string {
  const a = achievementId ? ACHIEVEMENT_BY_ID.get(achievementId) : undefined;
  return a ? `Unlock: ${a.name}` : "";
}

function Locked({ hint }: { hint: string }) {
  return (
    <span className="mt-1 block text-center text-[10.5px] text-text-tertiary" title={hint}>
      🔒 {hint.replace("Unlock: ", "")}
    </span>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const unlocks = useUnlocks();
  const userId = unlocks.userId;
  const displayName = unlocks.username ?? "You";
  const owned = ownedCosmetics(unlocks.owned);
  const ownsBack = new Set(owned.cardBacks.map((b) => b.id));
  const ownsTable = new Set(owned.tables.map((t) => t.id));
  const muted = !settings.sound || settings.volume === 0;
  const panel = useRef<HTMLDivElement>(null);

  const chooseAvatar = async (id: string) => {
    const prev = unlocks.avatar;
    unlocksStore.set({ avatar: id });
    if (!userId) return;
    const { error } = await createClient().from("profiles").update({ avatar: id }).eq("id", userId);
    if (error) unlocksStore.set({ avatar: prev });
  };

  const chooseTitle = async (id: string | null) => {
    const prev = unlocks.title;
    unlocksStore.set({ title: id });
    if (!userId) return;
    const { error } = await createClient().from("profiles").update({ title: id }).eq("id", userId);
    if (error) unlocksStore.set({ title: prev });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-border bg-surface-primary p-6 shadow-2xl outline-none"
        style={{ animation: "pop-in 200ms ease-out both" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-[22px] font-semibold tracking-tight">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md px-2 py-1 text-[20px] leading-none text-text-secondary hover:bg-white/5 hover:text-text-primary"
          >
            ×
          </button>
        </div>

        {userId && (
          <section aria-labelledby="avatar-heading" className="mb-6">
            <h3 id="avatar-heading" className="font-display text-[15px] font-semibold">
              Avatar
            </h3>
            <p className="mb-3 text-[12.5px] text-text-secondary">How you appear at the table, to friends, and on the leaderboard.</p>
            <div role="radiogroup" aria-labelledby="avatar-heading" className="grid grid-cols-6 gap-2 max-sm:grid-cols-4">
              {Object.values(AVATARS).map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={unlocks.avatar === a.id}
                  aria-label={a.name}
                  title={a.name}
                  onClick={() => chooseAvatar(a.id)}
                  className={`flex items-center justify-center rounded-xl border p-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                    unlocks.avatar === a.id ? "border-gold/70 bg-gold/[0.06]" : "border-border bg-surface-deep hover:border-text-tertiary"
                  }`}
                >
                  <Avatar name={displayName} avatar={a.id} size={40} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="deck-heading" className="mb-6">
          <h3 id="deck-heading" className="font-display text-[15px] font-semibold">
            Card faces
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">Make suits easier to tell apart at a glance.</p>
          <div role="radiogroup" aria-labelledby="deck-heading" className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
            {DECK_STYLES.map((d) => (
              <Option
                key={d.id}
                label={d.name}
                selected={settings.deckStyle === d.id}
                onSelect={() => settingsStore.set({ deckStyle: d.id })}
              >
                <div className="mb-2.5 flex gap-1">
                  {SAMPLE.map((c, i) => (
                    <PlayingCard key={i} card={c} size="xs" deckStyle={d.id} />
                  ))}
                </div>
                <div className="text-[13px] font-medium">{d.name}</div>
                <div className="text-[11.5px] text-text-tertiary">{d.hint}</div>
              </Option>
            ))}
          </div>
        </section>

        <section aria-labelledby="back-heading" className="mb-6">
          <h3 id="back-heading" className="font-display text-[15px] font-semibold">
            Card back
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">What opponents&apos; cards look like on your screen.</p>
          <div role="radiogroup" aria-labelledby="back-heading" className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {Object.values(CARD_BACKS).map((b) => {
              const locked = !ownsBack.has(b.id);
              return (
                <Option
                  key={b.id}
                  label={locked ? `${b.name} (locked)` : b.name}
                  selected={settings.cardBack === b.id}
                  onSelect={() => !locked && settingsStore.set({ cardBack: b.id })}
                >
                  <div className={`mb-2 flex justify-center ${locked ? "opacity-40 grayscale" : ""}`}>
                    <PlayingCard faceDown size="md" backSkin={b.id} />
                  </div>
                  <div className="text-center text-[12.5px] font-medium">{b.name}</div>
                  {b.unlock && <div className="text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: RARITY[b.rarity].color }}>{RARITY[b.rarity].label}</div>}
                  {locked && <Locked hint={unlockHint(b.unlock)} />}
                </Option>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="table-heading" className="mb-6">
          <h3 id="table-heading" className="font-display text-[15px] font-semibold">
            Table
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">The felt and rail on every table you sit at.</p>
          <div role="radiogroup" aria-labelledby="table-heading" className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {Object.values(TABLE_SKINS).map((t) => {
              const locked = !ownsTable.has(t.id);
              return (
                <Option
                  key={t.id}
                  label={locked ? `${t.name} (locked)` : t.name}
                  selected={settings.tableSkin === t.id}
                  onSelect={() => !locked && settingsStore.set({ tableSkin: t.id })}
                >
                  <div className={`mb-2 ${locked ? "opacity-40 grayscale" : ""}`}>
                    <TablePreview skin={t} />
                  </div>
                  <div className="text-center text-[12.5px] font-medium">{t.name}</div>
                  {t.unlock && <div className="text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: RARITY[t.rarity].color }}>{RARITY[t.rarity].label}</div>}
                  {locked && <Locked hint={unlockHint(t.unlock)} />}
                </Option>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="title-heading" className="mb-6">
          <h3 id="title-heading" className="font-display text-[15px] font-semibold">
            Title
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">
            {userId ? "Shown under your name at the table and on the leaderboard. Titles come from achievements." : "Sign in to earn and wear titles."}
          </p>
          <div role="radiogroup" aria-labelledby="title-heading" className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-2">
            <Option label="No title" selected={unlocks.title === null} onSelect={() => chooseTitle(null)}>
              <div className="text-center text-[12.5px] text-text-tertiary">No title</div>
            </Option>
            {Object.values(TITLES).map((t) => {
              const locked = !owned.titles.some((o) => o.id === t.id);
              return (
                <Option
                  key={t.id}
                  label={locked ? `${t.text} (locked)` : t.text}
                  selected={unlocks.title === t.id}
                  onSelect={() => !locked && chooseTitle(t.id)}
                >
                  <div className={`text-center ${locked ? "opacity-40 grayscale" : ""}`}>
                    <PlayerTitle id={t.id} size={11} />
                  </div>
                  {locked && <Locked hint={unlockHint(t.unlock)} />}
                </Option>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="chips-heading" className="mb-6">
          <h3 id="chips-heading" className="font-display text-[15px] font-semibold">
            Chips
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">Denominations run 0.5, 1, 5, 25, and 100 HP.</p>
          <div role="radiogroup" aria-labelledby="chips-heading" className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
            {Object.values(CHIP_SETS).map((c) => (
              <Option
                key={c.id}
                label={c.name}
                selected={settings.chips === c.id}
                onSelect={() => settingsStore.set({ chips: c.id })}
              >
                <div className="mb-2 flex -space-x-1.5">
                  {c.faces.map((f, i) => (
                    <ChipIcon key={i} face={f} size={30} />
                  ))}
                </div>
                <div className="text-[13px] font-medium">{c.name}</div>
              </Option>
            ))}
          </div>
        </section>

        <section aria-labelledby="sound-heading" className="mb-6">
          <h3 id="sound-heading" className="font-display text-[15px] font-semibold">
            Sound
          </h3>
          <p className="mb-3 text-[12.5px] text-text-secondary">Cards, chips, checks, your turn, and the clock.</p>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-deep p-3">
            <button
              onClick={() => settingsStore.set(muted ? { sound: true, volume: settings.volume || 0.6 } : { sound: false })}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                muted ? "border-red/40 bg-red/15 text-[#EFA3A3]" : "border-border text-text-primary hover:bg-white/5"
              }`}
            >
              <SpeakerIcon muted={muted} size={18} />
            </button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : settings.volume}
              onChange={(e) => settingsStore.set({ volume: Number(e.target.value), sound: Number(e.target.value) > 0 })}
              onPointerUp={() => play("bet")}
              className="hx-range flex-1"
            />
            <span className="w-10 text-right font-display text-[13px] font-semibold tabular-nums">
              {muted ? "Off" : `${Math.round(settings.volume * 100)}%`}
            </span>
            <button
              onClick={() => play("win")}
              disabled={muted}
              className="rounded-md border border-border px-2.5 py-1 text-[12px] text-text-secondary hover:bg-white/5 hover:text-text-primary disabled:opacity-40"
            >
              Test
            </button>
          </div>
        </section>

        <section aria-labelledby="clock-heading">
          <h3 id="clock-heading" className="font-display text-[15px] font-semibold">
            Practice clock
          </h3>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface-deep p-3">
            <span>
              <span className="block text-[13px] font-medium">Decision clock vs bots</span>
              <span className="block text-[12px] text-text-tertiary">
                When time runs out you check, or fold to a bet. Ranked games always use the clock.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.practiceClock}
              onChange={(e) => settingsStore.set({ practiceClock: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-[var(--gold)]"
            />
          </label>
        </section>
      </div>
    </div>
  );
}
