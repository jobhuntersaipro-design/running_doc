import type { ZoneNumber } from "@/lib/planner";

/** One-hue ramp for zones: light to strong, darker still for Zone 5 (dataviz sequential rule). */
export const ZONE_MIX: Record<ZoneNumber, { series: number; ink: number }> = {
  1: { series: 0.3, ink: 0 },
  2: { series: 0.5, ink: 0 },
  3: { series: 0.72, ink: 0 },
  4: { series: 1, ink: 0 },
  5: { series: 1, ink: 0.38 },
};

export type ColorBy = "hills" | "pace" | "hr";
