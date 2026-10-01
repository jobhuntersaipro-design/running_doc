import type { Plan } from "./types";

export type ZoneNumber = 1 | 2 | 3 | 4 | 5;
export const ZONES: ZoneNumber[] = [1, 2, 3, 4, 5];

export interface HrSettings {
  maxHr: number;
  restingHr: number;
  /** "max": % of max HR. "reserve": % of heart rate reserve (Karvonen). "custom": the runner's own numbers. */
  method: "max" | "reserve" | "custom";
  /** For "custom": the bpm where zones 1 to 5 start. */
  customStarts: [number, number, number, number, number];
}

export interface ZoneSettings {
  hr: HrSettings;
  /** Lactate threshold pace, sec/km. null means estimate it from the goal. */
  thresholdPace: number | null;
}

export interface HrZone {
  zone: ZoneNumber;
  name: string;
  /** Inclusive lower and upper bpm. */
  min: number;
  max: number;
}

export interface PaceZone {
  zone: ZoneNumber;
  name: string;
  /** Slowest and fastest pace in the zone, sec/km. Infinity / 0 for the open ends. */
  slowest: number;
  fastest: number;
}

export const HR_ZONE_NAMES = ["Recovery", "Easy", "Aerobic", "Threshold", "Maximum"] as const;
export const PACE_ZONE_NAMES = ["Recovery", "Easy", "Steady", "Threshold", "Fast"] as const;

/** Zone starts as a fraction of max HR or of heart rate reserve. */
const HR_FRACTIONS = [0.5, 0.6, 0.7, 0.8, 0.9];

/**
 * Pace zone edges as a percentage of threshold pace (time per km), after Joe
 * Friel's run pace zones: Zone 1 is slower than 129%, Zone 5 faster than 99%.
 */
const PACE_EDGES = [1.29, 1.14, 1.06, 0.99];

export const DEFAULT_ZONE_SETTINGS: ZoneSettings = {
  hr: { maxHr: 190, restingHr: 60, method: "max", customStarts: [95, 114, 133, 152, 171] },
  thresholdPace: null,
};

export function hrZones(s: HrSettings): HrZone[] {
  const starts =
    s.method === "custom"
      ? [...s.customStarts].sort((a, b) => a - b)
      : HR_FRACTIONS.map((f) => Math.round(s.method === "reserve" ? s.restingHr + f * (s.maxHr - s.restingHr) : f * s.maxHr));
  return ZONES.map((zone, i) => ({
    zone,
    name: HR_ZONE_NAMES[i],
    min: starts[i],
    max: i < 4 ? starts[i + 1] - 1 : s.maxHr,
  }));
}

export function hrZoneFor(zones: HrZone[], bpm: number): ZoneNumber {
  for (let i = zones.length - 1; i >= 0; i--) if (bpm >= zones[i].min) return zones[i].zone;
  return 1;
}

export function paceZones(thresholdSecPerKm: number): PaceZone[] {
  const edges = PACE_EDGES.map((p) => thresholdSecPerKm * p);
  return ZONES.map((zone, i) => ({
    zone,
    name: PACE_ZONE_NAMES[i],
    slowest: i === 0 ? Infinity : edges[i - 1],
    fastest: i === 4 ? 0 : edges[i],
  }));
}

export function paceZoneFor(thresholdSecPerKm: number, paceSecPerKm: number): ZoneNumber {
  const ratio = paceSecPerKm / thresholdSecPerKm;
  if (ratio > PACE_EDGES[0]) return 1;
  if (ratio > PACE_EDGES[1]) return 2;
  if (ratio > PACE_EDGES[2]) return 3;
  if (ratio > PACE_EDGES[3]) return 4;
  return 5;
}

/**
 * Threshold pace is roughly the pace you could hold for an hour. Estimate it
 * from the goal with Riegel's formula (T2 = T1 x (D2/D1)^1.06).
 */
export function estimateThresholdPace(goalSeconds: number, km: number): number {
  const hourKm = km * Math.pow(3600 / goalSeconds, 1 / 1.06);
  return 3600 / hourKm;
}

/** Share of max HR a runner typically averages for a race of this duration. */
function raceHrFraction(goalSeconds: number): number {
  const hours = goalSeconds / 3600;
  return Math.min(0.92, Math.max(0.75, 0.885 - 0.05 * Math.log(hours)));
}

export interface HrContext {
  km: number;
  totalKm: number;
  gradePct: number;
}

/**
 * Estimated heart rate at a point in the race: the typical race average for
 * this duration, a little lower over the easy start, drifting up as the race
 * goes on, up on climbs and the final push, down on descents.
 */
export function estimateHr(maxHr: number, goalSeconds: number, ctx: HrContext): number {
  let f = raceHrFraction(goalSeconds);
  if (ctx.km < 2) f -= 0.03 * (1 - ctx.km / 2);
  f += 0.03 * (ctx.km / ctx.totalKm) - 0.015; // cardiac drift, centred on the race average
  if (ctx.gradePct >= 1.2) f += Math.min(0.03, 0.01 * ctx.gradePct);
  if (ctx.gradePct <= -1.5) f -= 0.015;
  if (ctx.totalKm - ctx.km < 3) f += 0.02 * (1 - (ctx.totalKm - ctx.km) / 3);
  return Math.round(Math.min(maxHr, maxHr * f));
}

export function thresholdFor(plan: Plan, settings: ZoneSettings): number {
  return settings.thresholdPace ?? estimateThresholdPace(plan.summary.goalSeconds, plan.summary.totalKm);
}

export interface ZoneRun {
  startKm: number;
  endKm: number;
  zone: ZoneNumber;
}

export interface CourseZones {
  hrZones: HrZone[];
  paceZones: PaceZone[];
  thresholdPace: number;
  thresholdEstimated: boolean;
  /** Per 100 m interval of the profile. */
  intervals: { startKm: number; endKm: number; pace: number; hr: number; paceZone: ZoneNumber; hrZone: ZoneNumber }[];
  paceRuns: ZoneRun[];
  hrRuns: ZoneRun[];
  /** Seconds spent in each zone (index 0 is zone 1). */
  paceSeconds: number[];
  hrSeconds: number[];
}

/** Stretches shorter than this are folded into a neighbour so the map and chart stay readable. */
const MIN_RUN_KM = 0.4;

function coalesce(runs: ZoneRun[]): ZoneRun[] {
  const out: ZoneRun[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.zone === r.zone) last.endKm = r.endKm;
    else out.push({ ...r });
  }
  return out;
}

function runsOf(intervals: CourseZones["intervals"], key: "paceZone" | "hrZone"): ZoneRun[] {
  let runs = coalesce(intervals.map((it) => ({ startKm: it.startKm, endKm: it.endKm, zone: it[key] })));
  for (;;) {
    if (runs.length < 2) return runs;
    let idx = -1;
    runs.forEach((r, i) => {
      const len = r.endKm - r.startKm;
      if (len < MIN_RUN_KM && (idx === -1 || len < runs[idx].endKm - runs[idx].startKm)) idx = i;
    });
    if (idx === -1) return runs;
    const prev = runs[idx - 1];
    const next = runs[idx + 1];
    const target = !prev ? next : !next ? prev : prev.endKm - prev.startKm >= next.endKm - next.startKm ? prev : next;
    runs[idx] = { ...runs[idx], zone: target.zone };
    runs = coalesce(runs);
  }
}

/** Pace and heart rate zones along the whole course. */
export function courseZones(plan: Plan, settings: ZoneSettings): CourseZones {
  const threshold = thresholdFor(plan, settings);
  const hz = hrZones(settings.hr);
  const totalKm = plan.summary.totalKm;
  const p = plan.profile;
  const intervals: CourseZones["intervals"] = [];
  const paceSeconds = [0, 0, 0, 0, 0];
  const hrSeconds = [0, 0, 0, 0, 0];
  for (let i = 0; i < p.length - 1; i++) {
    const lenKm = p[i + 1].km - p[i].km;
    const pace = plan.timeline.paceSecPerKm[i];
    const grade = ((p[i + 1].ele - p[i].ele) / (lenKm * 1000)) * 100;
    const hr = estimateHr(settings.hr.maxHr, plan.summary.goalSeconds, { km: p[i].km + lenKm / 2, totalKm, gradePct: grade });
    const paceZone = paceZoneFor(threshold, pace);
    const hrZone = hrZoneFor(hz, hr);
    paceSeconds[paceZone - 1] += pace * lenKm;
    hrSeconds[hrZone - 1] += pace * lenKm;
    intervals.push({ startKm: p[i].km, endKm: p[i + 1].km, pace, hr, paceZone, hrZone });
  }
  return {
    hrZones: hz,
    paceZones: paceZones(threshold),
    thresholdPace: threshold,
    thresholdEstimated: settings.thresholdPace === null,
    intervals,
    paceRuns: runsOf(intervals, "paceZone"),
    hrRuns: runsOf(intervals, "hrZone"),
    paceSeconds,
    hrSeconds,
  };
}

/** The interval covering a distance. */
export function zoneAt(zones: CourseZones, km: number) {
  const list = zones.intervals;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].startKm <= km) lo = mid;
    else hi = mid - 1;
  }
  return list[lo];
}

/** Average estimated HR over a stretch of the course. */
export function averageHr(zones: CourseZones, fromKm: number, toKm: number): number {
  let sum = 0;
  let weight = 0;
  for (const it of zones.intervals) {
    const overlap = Math.min(toKm, it.endKm) - Math.max(fromKm, it.startKm);
    if (overlap > 0) {
      sum += it.hr * overlap;
      weight += overlap;
    }
  }
  return weight ? Math.round(sum / weight) : 0;
}
