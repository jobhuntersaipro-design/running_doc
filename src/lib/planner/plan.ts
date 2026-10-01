import { buildFuelEvents, DEFAULT_FUEL, type FuelOptions } from "./fuel";
import { formatPace } from "./format";
import { parseGpx } from "./gpx";
import { DEFAULT_PACING, buildTimeline, timeAt, type PacingOptions } from "./pacing";
import { buildProfile, elevationAt } from "./profile";
import { buildSegments } from "./segments";
import type { EffortTag, Plan, PlanEvent, Segment, Split, Station } from "./types";

export interface PlanInput {
  name: string;
  gpx: string;
  /** Official course length, km. The GPX is rescaled to match it. */
  officialKm: number;
  goalSeconds: number;
  stations: Station[];
  pacing?: PacingOptions;
  fuel?: FuelOptions;
}

function terrainEvents(segments: Segment[], paceOf: (s: Segment) => number, at: (km: number) => number): PlanEvent[] {
  const events: PlanEvent[] = [];
  for (const s of segments) {
    const len = s.lengthKm.toFixed(1);
    if (s.kind === "climb" && s.gain >= 10) {
      events.push({
        type: "climb",
        km: round1(s.startKm),
        elapsedSeconds: Math.round(at(s.startKm)),
        title: `Climb, +${Math.round(s.gain)} m over ${len} km`,
        detail: `Keep the effort steady and let your pace drop to about ${formatPace(paceOf(s))}/km. Shorten your stride and do not chase the goal pace uphill.`,
      });
    }
    if (s.kind === "descent" && s.loss >= 10) {
      events.push({
        type: "descent",
        km: round1(s.startKm),
        elapsedSeconds: Math.round(at(s.startKm)),
        title: `Downhill, -${Math.round(s.loss)} m over ${len} km`,
        detail: `Stay relaxed and avoid braking hard. About ${formatPace(paceOf(s))}/km is fine, so use it to recover rather than to bank time.`,
      });
    }
  }
  return events;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function tagFor(
  startKm: number,
  endKm: number,
  avgGrade: number,
  totalKm: number,
  prev: { tag: EffortTag; avgGrade: number } | undefined,
): EffortTag {
  if (startKm < 2) return "hold";
  if (avgGrade >= 1.2) return "hold";
  if (endKm > totalKm - 3 && avgGrade > -3) return "push";
  if (prev && prev.avgGrade >= 1.2 && avgGrade < 0.5) return "recover";
  return "cruise";
}

export function buildPlan(input: PlanInput): Plan {
  const points = parseGpx(input.gpx);
  const profile = buildProfile(points, input.officialKm);
  const segments = buildSegments(profile);
  const timeline = buildTimeline(profile, input.goalSeconds, input.pacing ?? DEFAULT_PACING);
  const at = (km: number) => timeAt(timeline, km);
  const totalKm = input.officialKm;
  const goalPace = input.goalSeconds / totalKm;

  const paceOf = (s: Segment) => (at(s.endKm) - at(s.startKm)) / s.lengthKm;

  const events: PlanEvent[] = ([
    {
      type: "start",
      km: 0,
      elapsedSeconds: 0,
      title: "Start easy",
      detail: `The first 2 km are planned a little slower than ${formatPace(goalPace)}/km. Crowds and adrenaline make it feel too easy, so hold back.`,
    },
    ...terrainEvents(segments, paceOf, at),
    ...buildFuelEvents(input.stations, segments, timeline, input.fuel ?? DEFAULT_FUEL),
    {
      type: "push",
      km: round1(totalKm - 2),
      elapsedSeconds: Math.round(at(totalKm - 2)),
      title: "Last 2 km",
      detail: "If your legs feel fine, now is the time to lift the effort. Empty the tank to the finish line.",
    },
  ] as PlanEvent[]).sort((a, b) => a.km - b.km || a.elapsedSeconds - b.elapsedSeconds);

  const splits: Split[] = [];
  const count = Math.ceil(totalKm - 1e-9);
  for (let k = 0; k < count; k++) {
    const startKm = k;
    const endKm = Math.min(k + 1, totalKm);
    const lengthKm = endKm - startKm;
    const t0 = at(startKm);
    const t1 = at(endKm);
    const avgGrade = ((elevationAt(profile, endKm) - elevationAt(profile, startKm)) / (lengthKm * 1000)) * 100;
    const prev = splits[splits.length - 1];
    splits.push({
      km: k + 1,
      startKm,
      endKm,
      lengthKm,
      paceSecPerKm: (t1 - t0) / lengthKm,
      splitSeconds: t1 - t0,
      cumulativeSeconds: t1,
      avgGrade,
      tag: tagFor(startKm, endKm, avgGrade, totalKm, prev),
      events: events.filter((e) => e.km >= startKm && (e.km < endKm || (k === count - 1 && e.km <= endKm))),
    });
  }

  const biggestClimb =
    segments.filter((s) => s.kind === "climb").sort((a, b) => b.gain - a.gain)[0] ?? null;
  const half = totalKm / 2;

  return {
    name: input.name,
    profile,
    segments,
    splits,
    events,
    summary: {
      goalSeconds: input.goalSeconds,
      goalPaceSecPerKm: goalPace,
      totalKm,
      totalGain: segments.reduce((s, x) => s + x.gain, 0),
      totalLoss: segments.reduce((s, x) => s + x.loss, 0),
      firstHalfSeconds: at(half),
      secondHalfSeconds: input.goalSeconds - at(half),
      gelCount: events.filter((e) => e.type === "gel").length,
      biggestClimb,
    },
  };
}
