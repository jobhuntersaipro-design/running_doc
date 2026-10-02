"use client";

import { useEffect, useSyncExternalStore } from "react";
import { EMPTY_PROFILE, isRunnerProfile, type RunnerProfile } from "@/lib/planner";

const listeners = new Set<() => void>();
let profile: RunnerProfile = EMPTY_PROFILE;
let loading: Promise<void> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function store(next: RunnerProfile) {
  profile = next;
  listeners.forEach((l) => l());
}

/** The signed-in runner's profile, loaded once per page. Empty when signed out or not saved yet. */
export function useRunnerProfile(): RunnerProfile {
  const value = useSyncExternalStore(subscribe, () => profile, () => EMPTY_PROFILE);
  useEffect(() => {
    loading ??= fetch("/api/me/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: unknown } | null) => {
        if (isRunnerProfile(data?.profile)) store(data.profile);
      })
      .catch(() => {});
  }, []);
  return value;
}

/** Saves the profile to the runner's account. Resolves whether it was saved. */
export async function saveRunnerProfile(next: RunnerProfile): Promise<boolean> {
  const res = await fetch("/api/me/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
  if (res?.ok) store(next);
  return Boolean(res?.ok);
}
