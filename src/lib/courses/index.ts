import { klscm2026Hm } from "./klscm-2026-hm";
import type { RaceMeta } from "./types";

/** Races shown in the overview. Add a race by adding its config and files here. */
export const RACES: RaceMeta[] = [klscm2026Hm];

export function getRace(id: string): RaceMeta | undefined {
  return RACES.find((r) => r.id === id);
}
