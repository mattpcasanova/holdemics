"use client";

import { useEffect } from "react";
import { type PlayerNote, type PlayerTag, notesStore } from "@/lib/notes";
import { type Settings, DEFAULT_SETTINGS, settingsStore } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";
import { unlocksStore } from "@/lib/unlocks";

const SAVE_DELAY_MS = 800;

/**
 * Keeps the local settings and player-notes stores in sync with the signed-in
 * account. On sign-in, account data wins; anything that only exists locally
 * (from playing as a guest) is uploaded. Afterwards, local changes are saved
 * back after a short debounce.
 */
export function AccountSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) {
      unlocksStore.set({ userId: null, owned: [], title: null, loaded: false });
      return;
    }
    const supabase = createClient();
    let ready = false;
    let cancelled = false;
    let synced: Record<string, PlayerNote> = {};

    const load = async () => {
      const [settingsRes, notesRes, cosmeticsRes, profileRes] = await Promise.all([
        supabase.from("user_settings").select("settings").eq("user_id", userId).maybeSingle(),
        supabase.from("player_notes").select("subject, tag, note, updated_at"),
        supabase.from("player_cosmetics").select("kind, item_id").eq("user_id", userId),
        supabase.from("profiles").select("title").eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      unlocksStore.set({ userId, owned: cosmeticsRes.data ?? [], title: profileRes.data?.title ?? null, loaded: true });

      const remoteSettings = (settingsRes.data?.settings ?? {}) as Partial<Settings>;
      if (Object.keys(remoteSettings).length) {
        settingsStore.set({ ...DEFAULT_SETTINGS, ...remoteSettings });
      } else {
        await supabase.from("user_settings").upsert({ user_id: userId, settings: settingsStore.get() });
      }

      const remote: Record<string, PlayerNote> = {};
      for (const row of notesRes.data ?? []) {
        remote[row.subject] = { tag: row.tag as PlayerTag | null, note: row.note, updatedAt: Date.parse(row.updated_at) };
      }
      const local = notesStore.get();
      const localOnly = Object.entries(local).filter(([key]) => !remote[key]);
      if (localOnly.length) {
        await supabase.from("player_notes").upsert(
          localOnly.map(([subject, n]) => ({ owner_id: userId, subject, tag: n.tag, note: n.note })),
        );
      }
      synced = { ...remote, ...Object.fromEntries(localOnly) };
      notesStore.set(() => synced);
      ready = true;
    };

    let settingsTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubSettings = settingsStore.subscribe(() => {
      if (!ready) return;
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => {
        void supabase.from("user_settings").upsert({ user_id: userId, settings: settingsStore.get() });
      }, SAVE_DELAY_MS);
    });

    let notesTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubNotes = notesStore.subscribe(() => {
      if (!ready) return;
      clearTimeout(notesTimer);
      notesTimer = setTimeout(async () => {
        const current = notesStore.get();
        const changed = Object.entries(current).filter(([k, n]) => synced[k]?.updatedAt !== n.updatedAt);
        const removed = Object.keys(synced).filter((k) => !current[k]);
        synced = { ...current };
        if (changed.length) {
          await supabase
            .from("player_notes")
            .upsert(changed.map(([subject, n]) => ({ owner_id: userId, subject, tag: n.tag, note: n.note })));
        }
        if (removed.length) {
          await supabase.from("player_notes").delete().eq("owner_id", userId).in("subject", removed);
        }
      }, SAVE_DELAY_MS);
    });

    void load();
    return () => {
      cancelled = true;
      clearTimeout(settingsTimer);
      clearTimeout(notesTimer);
      unsubSettings();
      unsubNotes();
    };
  }, [userId]);

  return null;
}
