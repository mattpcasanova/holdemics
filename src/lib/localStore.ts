"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store usable with useSyncExternalStore.
 * Reads/writes are guarded: private windows or blocked storage fall back to memory.
 */
export function createLocalStore<T extends object>(key: string, defaults: T) {
  let value: T = defaults;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) value = { ...defaults, ...JSON.parse(raw) };
    } catch {
      // Storage unavailable; keep defaults.
    }
  };

  const store = {
    get(): T {
      load();
      return value;
    },
    set(patch: Partial<T> | ((prev: T) => T)) {
      load();
      value = typeof patch === "function" ? patch(value) : { ...value, ...patch };
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore write failures; the in-memory value still updates.
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    use(): T {
      return useSyncExternalStore(store.subscribe, store.get, () => defaults);
    },
  };
  return store;
}
