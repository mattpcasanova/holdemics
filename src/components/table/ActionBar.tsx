"use client";

import { useEffect, useState } from "react";
import type { Action, LegalActions } from "@/lib/engine/game";
import { UNITS_PER_HP, formatHp } from "@/lib/engine/modes";
import { type ClockInfo, ClockReadout } from "./Clock";

interface ActionBarProps {
  legal: LegalActions | null;
  pot: number;
  currentBet: number;
  bigBlind: number;
  preflop: boolean;
  onAct: (action: Action) => void;
  /** Shown when it isn't the hero's turn. */
  idleText: string;
  clock?: ClockInfo | null;
}

const HALF_HP = UNITS_PER_HP / 2;

function roundToHalf(units: number) {
  return Math.round(units / HALF_HP) * HALF_HP;
}

/** Keep only digits and one decimal point, and drop leading zeros ("020" -> "20"). */
function sanitizeAmount(text: string): string {
  let t = text.replace(/[^0-9.]/g, "");
  const dot = t.indexOf(".");
  if (dot >= 0) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "").slice(0, 1);
  t = t.replace(/^0+(?=\d)/, "");
  return t;
}

export function ActionBar({ legal, pot, currentBet, bigBlind, preflop, onAct, idleText, clock }: ActionBarProps) {
  const [raiseTo, setRaiseTo] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;

  // Reset the sizer to the minimum whenever a new decision starts.
  const decisionKey = legal ? `${min}-${max}-${currentBet}` : "idle";
  const [lastKey, setLastKey] = useState(decisionKey);
  if (decisionKey !== lastKey) {
    setLastKey(decisionKey);
    setRaiseTo(min);
    setDraft(null);
  }

  const clamp = (v: number) => Math.max(min, Math.min(max, roundToHalf(v)));
  const setSize = (v: number) => {
    setDraft(null);
    setRaiseTo(clamp(v));
  };
  const potAfterCall = pot + (legal?.callAmount ?? 0);
  const presets = preflop
    ? [
        { label: "2.5x", to: 2.5 * Math.max(currentBet, bigBlind) },
        { label: "3x", to: 3 * Math.max(currentBet, bigBlind) },
        { label: "Pot", to: currentBet + potAfterCall },
        { label: "All in", to: max },
      ]
    : [
        { label: "⅓", to: currentBet + potAfterCall / 3 },
        { label: "½", to: currentBet + potAfterCall / 2 },
        { label: "¾", to: currentBet + (potAfterCall * 3) / 4 },
        { label: "Pot", to: currentBet + potAfterCall },
        { label: "All in", to: max },
      ];

  const size = clamp(raiseTo);
  const raiseVerb = legal?.isBet ? "Bet" : "Raise to";
  const allIn = size >= max;

  const commitDraft = () => {
    if (draft === null) return;
    const hp = parseFloat(draft);
    setSize(Number.isFinite(hp) ? hp * UNITS_PER_HP : min);
  };

  useEffect(() => {
    if (!legal) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type !== "range");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const step = (e.shiftKey ? 5 : 1) * bigBlind;

      // Enter bets/raises the current size; Space checks when free, otherwise folds.
      if (key === "enter" || key === " ") {
        e.preventDefault();
        if (e.repeat) return;
        // Drop focus so a focused button isn't also activated by the same key.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        if (key === " ") onAct({ type: legal.canCheck ? "check" : "fold" });
        else if (legal.canRaise) onAct({ type: "raise", to: size });
        return;
      }

      if (key === "f" && !legal.canCheck) onAct({ type: "fold" });
      else if (key === "c") onAct({ type: legal.canCheck ? "check" : "call" });
      else if ((key === "r" || key === "b") && legal.canRaise) onAct({ type: "raise", to: size });
      else if (legal.canRaise && (key === "arrowup" || key === "arrowright")) setSize(size + step);
      else if (legal.canRaise && (key === "arrowdown" || key === "arrowleft")) setSize(size - step);
      else if (legal.canRaise && /^[1-5]$/.test(key) && presets[Number(key) - 1]) setSize(presets[Number(key) - 1].to);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!legal) {
    return (
      <div className="flex h-[64px] items-center justify-center rounded-xl border border-border bg-surface-deep px-3 text-center text-[13px] text-text-secondary sm:h-[112px]">
        {idleText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-felt/50 bg-surface-deep p-2.5 shadow-[0_0_0_1px_rgba(31,111,74,0.25)] sm:h-[112px] sm:flex-row sm:items-stretch sm:gap-3 sm:p-3">
      {clock && (
        <div className="flex shrink-0 items-center justify-center rounded-lg bg-surface-primary max-sm:hidden sm:w-[64px]">
          <ClockReadout clock={clock} />
        </div>
      )}

      {legal.canRaise && (
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:gap-0">
          <div className="flex gap-1">
            {clock && (
              <div className="flex w-[52px] shrink-0 items-center justify-center rounded-md bg-surface-primary sm:hidden">
                <ClockReadout clock={clock} compact />
              </div>
            )}
            {presets.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSize(p.to)}
                className="relative flex-1 rounded-md border border-border bg-surface-primary py-1.5 text-[12px] text-text-secondary transition-colors hover:border-text-tertiary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              >
                {p.label}
                <span className="absolute right-1 top-0.5 text-[9px] text-text-tertiary max-sm:hidden">{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Raise amount"
              min={min}
              max={max}
              step={HALF_HP}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="hx-range flex-1"
            />
            <label className="flex items-center gap-1 rounded-md border border-border bg-surface-primary px-2 py-1 focus-within:border-gold/60">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Raise amount in HP"
                value={draft ?? formatHp(size)}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDraft(sanitizeAmount(e.target.value))}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitDraft();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setDraft(null);
                    e.currentTarget.blur();
                  }
                }}
                className="w-14 bg-transparent text-right font-display text-[15px] font-semibold tabular-nums text-gold outline-none"
              />
              <span className="text-[11px] text-text-tertiary">HP</span>
            </label>
          </div>
          <div className="text-[10px] text-text-tertiary max-sm:hidden">
            ↑ ↓ adjust by 1 BB, Shift for 5 BB, 1–{presets.length} presets
          </div>
        </div>
      )}

      <div className={`flex h-[56px] gap-2 sm:h-auto ${legal.canRaise ? "sm:w-[360px]" : "flex-1"}`}>
        {clock && !legal.canRaise && (
          <div className="flex w-[52px] shrink-0 items-center justify-center rounded-lg bg-surface-primary sm:hidden">
            <ClockReadout clock={clock} compact />
          </div>
        )}
        {!legal.canCheck && (
          <ActionButton tone="fold" hotkey="F · Space" onClick={() => onAct({ type: "fold" })}>
            Fold
          </ActionButton>
        )}
        <ActionButton tone="neutral" hotkey={legal.canCheck ? "C · Space" : "C"} onClick={() => onAct({ type: legal.canCheck ? "check" : "call" })}>
          {legal.canCheck ? "Check" : `Call ${formatHp(legal.callAmount)}`}
        </ActionButton>
        {legal.canRaise && (
          <ActionButton tone="raise" hotkey="R · Enter" wide onClick={() => onAct({ type: "raise", to: size })}>
            {allIn ? `All in ${formatHp(max)}` : `${raiseVerb} ${formatHp(size)}`}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  tone,
  hotkey,
  wide,
  onClick,
  children,
}: {
  tone: "fold" | "neutral" | "raise";
  hotkey: string;
  wide?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    fold: "bg-red/15 border-red/40 text-[#EFA3A3] hover:bg-red/25",
    neutral: "bg-white/[0.06] border-white/15 text-text-primary hover:bg-white/10",
    raise: "bg-gold border-gold text-surface-primary hover:brightness-110",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center rounded-lg border font-display text-[15px] font-semibold tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${styles} ${
        wide ? "flex-[1.5]" : "flex-1"
      }`}
    >
      {children}
      <span className={`mt-0.5 text-[10px] font-normal max-sm:hidden ${tone === "raise" ? "text-surface-primary/60" : "text-text-tertiary"}`}>
        {hotkey}
      </span>
    </button>
  );
}
