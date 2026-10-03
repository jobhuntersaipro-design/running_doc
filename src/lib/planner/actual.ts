import { timeAt } from "./pacing";
import { haversineM, interpolate } from "./profile";
import type { HillInfo, Plan } from "./types";

/** One timed point of a run recorded by a watch or phone. */
export interface RunPoint {
  lat: number;
  lon: number;
  /** Milliseconds since 1970. */
  t: number;
  hr?: number;
}

/** Reads the timed track points of a run exported as GPX (Garmin Connect, Strava, COROS and others). */
export function parseRun(xml: string): RunPoint[] {
  const points: RunPoint[] = [];
  const re = /<trkpt([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = Number(/lat\s*=\s*"([^"]+)"/.exec(m[1])?.[1]);
    const lon = Number(/lon\s*=\s*"([^"]+)"/.exec(m[1])?.[1]);
    const t = Date.parse(/<time>\s*([^<\s]+)\s*<\/time>/.exec(m[2])?.[1] ?? "");
    const hr = Number(/<(?:[\w-]+:)?hr>\s*(\d+)\s*</.exec(m[2])?.[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(t)) points.push({ lat, lon, t, hr: hr > 0 ? hr : undefined });
  }
  if (points.length < 2) throw new Error("This file has no timed track points. Export the run itself as GPX from your watch app");
  return points;
}

export interface KmReview {
  km: number;
  lengthKm: number;
  plannedSeconds: number;
  actualSeconds: number;
  /** Average heart rate over the km, when the file has it. */
  hr?: number;
}

export interface HillReview {
  hill: HillInfo;
  plannedSeconds: number;
  actualSeconds: number;
}

export interface RunReview {
  finishSeconds: number;
  /** Distance the watch measured; it is stretched to the official distance to line up with the plan. */
  gpsKm: number;
  firstHalfSeconds: number;
  secondHalfSeconds: number;
  splits: KmReview[];
  uphills: HillReview[];
}

/** Lines a recorded run up with the plan, km by km and hill by hill. */
export function reviewRun(plan: Plan, run: RunPoint[]): RunReview {
  const dist = [0];
  for (let i = 1; i < run.length; i++) dist.push(dist[i - 1] + haversineM(run[i - 1], run[i]) / 1000);
  const gpsKm = dist[dist.length - 1];
  if (gpsKm < 0.5) throw new Error("This run is too short to compare with the plan");
  const total = plan.summary.totalKm;
  // ponytail: stretches GPS distance evenly to the official distance; a per-km match to the course line would be finer.
  const km = dist.map((d) => (d * total) / gpsKm);
  const secs = run.map((p) => (p.t - run[0].t) / 1000);
  const at = (x: number) => interpolate(km, secs, x);
  const hrBetween = (a: number, b: number) => {
    const hrs = run.filter((p, i) => p.hr !== undefined && km[i] >= a && km[i] <= b).map((p) => p.hr!);
    return hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : undefined;
  };
  return {
    finishSeconds: secs[secs.length - 1],
    gpsKm,
    firstHalfSeconds: at(total / 2),
    secondHalfSeconds: secs[secs.length - 1] - at(total / 2),
    splits: plan.splits.map((s) => ({
      km: s.km,
      lengthKm: s.lengthKm,
      plannedSeconds: s.splitSeconds,
      actualSeconds: at(s.endKm) - at(s.startKm),
      hr: hrBetween(s.startKm, s.endKm),
    })),
    uphills: plan.hills
      .filter((h) => h.kind === "uphill")
      .map((hill) => ({
        hill,
        plannedSeconds: timeAt(plan.timeline, hill.endKm) - timeAt(plan.timeline, hill.startKm),
        actualSeconds: at(hill.endKm) - at(hill.startKm),
      })),
  };
}
