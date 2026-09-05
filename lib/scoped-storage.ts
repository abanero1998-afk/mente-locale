"use client";

import type { StateStorage } from "zustand/middleware";

/** Active locale for persist key prefixing. Empty = not logged in. */
let currentLocaleId = "";

export function setCurrentLocaleId(id: string) {
  currentLocaleId = (id || "").trim().toLowerCase();
}

export function getCurrentLocaleId() {
  return currentLocaleId;
}

/** Persist key as stored in localStorage: `ml:${localeId}:${baseName}` */
export function scopedPersistKey(baseName: string, localeId?: string) {
  const id = (localeId ?? currentLocaleId) || "_none";
  return `ml:${id}:${baseName}`;
}

/**
 * Zustand storage that namespaces every key under the current locale.
 * Prove isolation: Locale A → ml:locale-a:mente-locale-v8 ; Locale B → ml:locale-b:…
 */
export const scopedStorage: StateStorage = {
  getItem: (name) => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(scopedPersistKey(name));
  },
  setItem: (name, value) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(scopedPersistKey(name), value);
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(scopedPersistKey(name));
  },
};

const MIGRATE_FLAG = "ml-migrated-v8";

const LEGACY_MAP: { legacy: string; scoped: string }[] = [
  { legacy: "mente-locale-v7", scoped: "mente-locale-v8" },
  { legacy: "ml-cassa-v2", scoped: "ml-cassa-v3" },
  { legacy: "mente-locale-locale-v1", scoped: "mente-locale-locale-v2" },
];

/** One-time: copy old global keys into the first locale namespace. */
export function migrateLegacyToLocale(localeId: string) {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATE_FLAG)) return;
  let copied = false;
  for (let i = 0; i < LEGACY_MAP.length; i++) {
    const row = LEGACY_MAP[i];
    const raw = localStorage.getItem(row.legacy);
    if (!raw) continue;
    const dest = scopedPersistKey(row.scoped, localeId);
    if (!localStorage.getItem(dest)) {
      localStorage.setItem(dest, raw);
      copied = true;
    }
  }
  if (copied || LEGACY_MAP.some((r) => localStorage.getItem(r.legacy))) {
    localStorage.setItem(MIGRATE_FLAG, localeId);
  }
}
