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
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function read(): ZoneSettings {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    cache = isZoneSettings(parsed) ? parsed : DEFAULT_ZONE_SETTINGS;
  } catch {
    cache = DEFAULT_ZONE_SETTINGS;
  }
  return cache;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function store(next: ZoneSettings) {
  cache = next;
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

/** Zone settings: kept in this browser, and in the runner's account when signed in. The server render uses the defaults. */
export function useZoneSettings(): [ZoneSettings, (next: ZoneSettings) => void, ZoneAccount] {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_ZONE_SETTINGS);
  const acct = useSyncExternalStore(subscribe, () => account, () => "unknown" as ZoneAccount);
  useEffect(loadFromAccount, []);
  const save = (next: ZoneSettings) => {
    store(next);
    if (account !== "signed-in") return;
    clearTimeout(saveTimer);
    // Number fields change on every step; send the last value once the runner pauses.
    saveTimer = setTimeout(() => {
      fetch("/api/me/zones", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
    }, 800);
  };
  return [settings, save, acct];
}
