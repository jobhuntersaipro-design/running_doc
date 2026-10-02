"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_ZONE_SETTINGS, isZoneSettings, type ZoneSettings } from "@/lib/planner";

const KEY = "race-plan-zones";
const listeners = new Set<() => void>();
let cache: ZoneSettings | null = null;

/** Whether zones are kept in the runner's account. "unknown" until /api/me/zones answers. */
export type ZoneAccount = "unknown" | "signed-out" | "signed-in";
let account: ZoneAccount = "unknown";
let loading: Promise<void> | null = null;
/** The last saved settings; `cache` runs ahead of it while the runner edits. */
let persisted: ZoneSettings | null = null;

function read(): ZoneSettings {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    cache = isZoneSettings(parsed) ? parsed : DEFAULT_ZONE_SETTINGS;
  } catch {
    cache = DEFAULT_ZONE_SETTINGS;
  }
  persisted = cache;
  return cache;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function store(next: ZoneSettings) {
  cache = next;
  persisted = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked; the settings still apply for this visit.
  }
  listeners.forEach((l) => l());
}

/** Once per page: a signed-in runner's saved zones replace the ones in this browser. */
function loadFromAccount() {
  loading ??= fetch("/api/me/zones")
    .then(async (res) => {
      if (!res.ok) {
        account = "signed-out";
        return;
      }
      account = "signed-in";
      const { settings } = (await res.json()) as { settings: unknown };
      if (isZoneSettings(settings)) store(settings);
    })
    .catch(() => {
      account = "signed-out";
    })
    .finally(() => listeners.forEach((l) => l()));
}

const isDirty = () => cache !== null && persisted !== null && JSON.stringify(cache) !== JSON.stringify(persisted);

/**
 * Zone settings. Edits preview straight away everywhere (zones, map, charts)
 * and are kept only when the runner saves: in this browser, and in their
 * account when signed in. The server render uses the defaults.
 */
export function useZoneSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_ZONE_SETTINGS);
  const dirty = useSyncExternalStore(subscribe, isDirty, () => false);
  const acct = useSyncExternalStore(subscribe, () => account, () => "unknown" as ZoneAccount);
  useEffect(loadFromAccount, []);
  return {
    settings,
    dirty,
    account: acct,
    preview(next: ZoneSettings) {
      cache = next;
      listeners.forEach((l) => l());
    },
    discard() {
      cache = persisted;
      listeners.forEach((l) => l());
    },
    /** Saves the current settings; resolves false if the account save failed (they are still kept in this browser). */
    async save(): Promise<boolean> {
      const next = read();
      store(next);
      if (account !== "signed-in") return true;
      const res = await fetch("/api/me/zones", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
      return Boolean(res?.ok);
    },
  };
}
