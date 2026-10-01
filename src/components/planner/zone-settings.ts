"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ZONE_SETTINGS, type ZoneSettings } from "@/lib/planner";

const KEY = "race-plan-zones";
const listeners = new Set<() => void>();
let cache: ZoneSettings | null = null;

function isValid(v: unknown): v is ZoneSettings {
  const s = v as ZoneSettings;
  return (
    !!s &&
    typeof s.hr?.maxHr === "number" &&
    typeof s.hr?.restingHr === "number" &&
    ["max", "reserve", "custom"].includes(s.hr?.method) &&
    Array.isArray(s.hr?.customStarts) &&
    s.hr.customStarts.length === 5 &&
    (s.thresholdPace === null || typeof s.thresholdPace === "number")
  );
}

function read(): ZoneSettings {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    cache = isValid(parsed) ? parsed : DEFAULT_ZONE_SETTINGS;
  } catch {
    cache = DEFAULT_ZONE_SETTINGS;
  }
  return cache;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Zone settings remembered in this browser. The server render uses the defaults. */
export function useZoneSettings(): [ZoneSettings, (next: ZoneSettings) => void] {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_ZONE_SETTINGS);
  const save = (next: ZoneSettings) => {
    cache = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the settings still apply for this visit.
    }
    listeners.forEach((l) => l());
  };
  return [settings, save];
}
