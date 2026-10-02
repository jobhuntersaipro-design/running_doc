import { klscm2026_10k, klscm2026_5k, klscm2026Fm } from "./klscm-2026";
import { klscm2026Hm } from "./klscm-2026-hm";
import type { RaceMeta } from "./types";

/** Races shown in the overview. Add a race by adding its config and files here. */
export const RACES: RaceMeta[] = [klscm2026_5k, klscm2026_10k, klscm2026Hm, klscm2026Fm];

export function getRace(id: string): RaceMeta | undefined {
  return RACES.find((r) => r.id === id);
}
