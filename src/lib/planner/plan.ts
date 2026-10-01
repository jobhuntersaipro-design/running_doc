import { buildPaceBlocks } from "./blocks";
import { hillInfo } from "./hills";
import { addRunnerNotes, buildChapters } from "./mind";
import { buildFuelEvents, DEFAULT_FUEL, type FuelOptions } from "./fuel";
import { formatPace } from "./format";
import { parseGpx } from "./gpx";
import { DEFAULT_PACING, buildTimeline, timeAt, type PacingOptions } from "./pacing";
import { buildProfile, elevationAt, haversineM } from "./profile";
import { buildSegments } from "./segments";
import type { EffortTag, HillInfo, Plan, PlanEvent, Split, Station, TrackPoint, TrackSample } from "./types";

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

function terrainEvents(hills: HillInfo[], at: (km: number) => number): PlanEvent[] {
  return hills.map((h) => {
    const len = h.lengthKm.toFixed(1);
    const pace = formatPace(h.paceSecPerKm);
    const elevation = `${Math.round(h.startEle)} m to ${Math.round(h.peakEle)} m`;
    return h.kind === "uphill"
      ? {
          type: "uphill",
          km: round1(h.startKm),
          elapsedSeconds: Math.round(at(h.startKm)),
          title: `Uphill, +${Math.round(h.change)} m over ${len} km`,
          detail: `Rises from ${elevation}. Keep the effort steady and let your pace drop to about ${pace}/km. Shorten your stride and do not chase the goal pace uphill.`,
          hill: h,
        }
      : {
          type: "downhill",
          km: round1(h.startKm),
          elapsedSeconds: Math.round(at(h.startKm)),
          title: `Downhill, -${Math.round(h.change)} m over ${len} km`,
          detail: `Drops from ${elevation}. Stay relaxed and avoid braking hard. About ${pace}/km is fine, so use it to recover rather than to bank time.`,
          hill: h,
        };
  });
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

function buildTrack(points: TrackPoint[], officialKm: number): TrackSample[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  const scale = officialKm / (cum[cum.length - 1] / 1000);
  return points.map((p, i) => ({ lat: p.lat, lon: p.lon, km: (cum[i] / 1000) * scale }));
}

export function buildPlan(input: PlanInput): Plan {
  const points = parseGpx(input.gpx);
  const profile = buildProfile(points, input.officialKm);
  const segments = buildSegments(profile);
  const timeline = buildTimeline(profile, input.goalSeconds, input.pacing ?? DEFAULT_PACING);
  const at = (km: number) => timeAt(timeline, km);
  const totalKm = input.officialKm;
  const goalPace = input.goalSeconds / totalKm;

  const paceBetween = (from: number, to: number) => (at(to) - at(from)) / (to - from);
  const hills = segments.map((s) => hillInfo(s, profile, paceBetween)).filter((h): h is HillInfo => h !== null);

  const events: PlanEvent[] = addRunnerNotes(([
    {
      type: "start",
      km: 0,
      elapsedSeconds: 0,
      title: "Start easy",
      detail: `The first 2 km are planned a little slower than ${formatPace(goalPace)}/km. Crowds and adrenaline make it feel too easy, so hold back.`,
    },
    ...terrainEvents(hills, at),
    ...buildFuelEvents(input.stations, segments, timeline, input.fuel ?? DEFAULT_FUEL),
    {
      type: "push",
      km: round1(totalKm - 2),
      elapsedSeconds: Math.round(at(totalKm - 2)),
      title: "Last 2 km",
      detail: "If your legs feel fine, now is the time to lift the effort. Empty the tank to the finish line.",
    },
  ] as PlanEvent[]).sort((a, b) => a.km - b.km || a.elapsedSeconds - b.elapsedSeconds));

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
    segments.filter((s) => s.kind === "uphill").sort((a, b) => b.gain - a.gain)[0] ?? null;
  const half = totalKm / 2;

  return {
    name: input.name,
    profile,
    track: buildTrack(points, input.officialKm),
    timeline,
    blocks: buildPaceBlocks(splits),
    segments,
    splits,
    events,
    hills,
    chapters: buildChapters(totalKm, hills, timeline),
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
