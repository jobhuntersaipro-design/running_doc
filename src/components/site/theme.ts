"use client";

import { useSyncExternalStore } from "react";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";

// The inline script in the layout sets data-theme before paint; follow it from there.
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
}

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
}
