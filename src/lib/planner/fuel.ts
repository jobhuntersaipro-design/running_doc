import { kmAtTime, timeAt } from "./pacing";
import { formatClock } from "./format";
import type { PlanEvent, Segment, Station, Timeline } from "./types";

export interface FuelOptions {
  /** Elapsed minutes at which the first gel is taken. */
  firstGelMin: number;
  gelIntervalMin: number;
  /** No gel is planned if fewer than this many minutes would remain. */
  minRemainingMin: number;
  /** Below this goal time (minutes) no gels are planned. */
  minGoalMin: number;
  /** How far (km) a gel may move to line up with a station. */
  snapKm: number;
}

export const DEFAULT_FUEL: FuelOptions = {
  firstGelMin: 40,
  gelIntervalMin: 40,
  minRemainingMin: 20,
  minGoalMin: 75,
  snapKm: 2,
};

const DRINK_KINDS = ["water", "isotonic"] as const;

function inClimb(segments: Segment[], km: number): boolean {
  return segments.some((s) => s.kind === "climb" && km > s.startKm && km < s.endKm);
}

function hasDrink(s: Station): boolean {
  return s.kinds.some((k) => (DRINK_KINDS as readonly string[]).includes(k));
}

/** Gel, drink, cooling and banana events for the whole course. */
export function buildFuelEvents(
  stations: Station[],
  segments: Segment[],
  timeline: Timeline,
  options: FuelOptions = DEFAULT_FUEL,
): PlanEvent[] {
  const events: PlanEvent[] = [];
  const goalSeconds = timeline.t[timeline.t.length - 1];
  const totalKm = timeline.km[timeline.km.length - 1];
  const make = (
    type: PlanEvent["type"],
    km: number,
    title: string,
    detail: string,
  ): PlanEvent => ({
    type,
    km: Math.round(km * 10) / 10,
    elapsedSeconds: Math.round(timeAt(timeline, km)),
    title,
    detail,
  });

  const drinkStations = stations.filter(hasDrink).sort((a, b) => a.km - b.km);

  drinkStations.forEach((s, i) => {
    const isotonic = s.kinds.includes("isotonic");
    const water = s.kinds.includes("water");
    const what = isotonic && water ? "Water or isotonic" : isotonic ? "Isotonic" : "Water";
    const detail =
      i === 0
        ? "Ease off for a few steps, take a cup, sip, and keep moving. Do not stop or run flat out through the tables."
        : isotonic && !water
          ? "A few sips of isotonic for sugar and salt, then back to pace."
          : isotonic
            ? "A few sips. Isotonic adds sugar and salt; water is fine if your stomach prefers it."
            : "A few sips and keep moving.";
    events.push(make("drink", s.km, `${what} station`, detail));
  });
  for (const s of stations) {
    if (s.kinds.includes("splash")) {
      events.push(make("cool", s.km, "Splash zone", "Wet your head and neck to cool down in the heat."));
    }
    if (s.kinds.includes("banana")) {
      events.push(make("banana", s.km, "Banana", "Optional. Take a few bites if you want solid food."));
    }
  }

  if (goalSeconds / 60 >= options.minGoalMin) {
    const gelStations = stations.filter((s) => s.kinds.includes("gel"));
    // Candidate gel spots: official gel stations, or just before a drink station
    // so the gel can be washed down with water.
    const candidates = [
      ...gelStations.map((s) => ({ km: s.km, official: true, drinkKm: nextDrinkKm(drinkStations, s.km) })),
      ...drinkStations.map((s) => ({ km: s.km - 0.3, official: false, drinkKm: s.km })),
    ].filter((c) => c.km > 0.5);

    let gelNumber = 0;
    for (
      let min = options.firstGelMin;
      min * 60 + options.minRemainingMin * 60 <= goalSeconds;
      min += options.gelIntervalMin
    ) {
      const desired = kmAtTime(timeline, min * 60);
      const pool = candidates.filter((c) => Math.abs(c.km - desired) <= options.snapKm);
      const clear = pool.filter((c) => !inClimb(segments, c.km));
      const best = (clear.length ? clear : pool).sort(
        (a, b) => Math.abs(a.km - desired) - Math.abs(b.km - desired),
      )[0];

      gelNumber += 1;
      const km = best ? best.km : Math.min(desired, totalKm - 1);
      const after = best?.drinkKm
        ? `Wash it down with water at the station at km ${best.drinkKm.toFixed(1)}.`
        : "Take it with water.";
      const source = best?.official
        ? "Use your own gel as the default and treat the official station as a backup."
        : "Carry this one yourself.";
      events.push(
        make("gel", km, `Gel ${gelNumber}`, `About ${formatClock(timeAt(timeline, km))} in. ${after} ${source}`),
      );
    }
  }

  return events.sort((a, b) => a.km - b.km);
}

function nextDrinkKm(drinkStations: Station[], km: number): number | undefined {
  return drinkStations.find((s) => s.km >= km)?.km;
}
