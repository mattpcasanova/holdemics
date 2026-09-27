"use client";

import { settingsStore, useSettings } from "@/lib/settings";

export function SpeakerIcon({ muted, size = 16 }: { muted: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

/** One-click mute for the table header. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const { sound, volume } = useSettings();
  const muted = !sound || volume === 0;
  return (
    <button
      onClick={() => settingsStore.set(muted ? { sound: true, volume: volume || 0.6 } : { sound: false })}
      aria-label={muted ? "Unmute table sounds" : "Mute table sounds"}
      aria-pressed={muted}
      title={muted ? "Unmute" : "Mute"}
      className={className}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
