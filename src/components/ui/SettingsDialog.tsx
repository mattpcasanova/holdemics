"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChipIcon } from "@/components/table/ChipStack";
import { PlayingCard } from "@/components/table/PlayingCard";
import { CARD_BACKS, CHIP_SETS } from "@/lib/cosmetics";
import type { Card } from "@/lib/engine/cards";
import { type DeckStyle, settingsStore, useSettings } from "@/lib/settings";

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

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const panel = useRef<HTMLDivElement>(null);

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
            {Object.values(CARD_BACKS).map((b) => (
              <Option
                key={b.id}
                label={b.name}
                selected={settings.cardBack === b.id}
                onSelect={() => settingsStore.set({ cardBack: b.id })}
              >
                <div className="mb-2 flex justify-center">
                  <PlayingCard faceDown size="md" backSkin={b.id} />
                </div>
                <div className="text-center text-[12.5px] font-medium">{b.name}</div>
              </Option>
            ))}
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
