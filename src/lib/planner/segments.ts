import type { ProfileSample, Segment, SegmentKind } from "./types";

interface Run {
  kind: SegmentKind;
  from: number; // interval index, inclusive
  to: number; // interval index, exclusive
}

export interface SegmentOptions {
  /** Gradient (percent) beyond which an interval counts as climb or descent. */
  gradeThreshold: number;
  /** Runs shorter than this are absorbed by a neighbour. */
  minLengthM: number;
  /** Climbs/descents with less net elevation change than this become flat. */
  minNetM: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  gradeThreshold: 1.2,
  minLengthM: 400,
  minNetM: 4,
};

function lengthM(profile: ProfileSample[], run: Run): number {
  return (profile[run.to].km - profile[run.from].km) * 1000;
}

function coalesce(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === r.kind) prev.to = r.to;
    else out.push({ ...r });
  }
  return out;
}

function absorbShort(profile: ProfileSample[], runs: Run[], minM: number): Run[] {
  let current = coalesce(runs);
  for (;;) {
    if (current.length < 2) return current;
    let idx = -1;
    let shortest = Infinity;
    current.forEach((r, i) => {
      const len = lengthM(profile, r);
      if (len < minM && len < shortest) {
        shortest = len;
        idx = i;
      }
    });
    if (idx === -1) return current;
    const prev = current[idx - 1];
    const next = current[idx + 1];
    const target =
      !prev ? next : !next ? prev : lengthM(profile, prev) >= lengthM(profile, next) ? prev : next;
    current[idx] = { ...current[idx], kind: target.kind };
    current = coalesce(current);
  }
}

/** Splits the course into climbs, descents and flat sections. */
export function buildSegments(
  profile: ProfileSample[],
  options: SegmentOptions = DEFAULT_SEGMENT_OPTIONS,
): Segment[] {
  const n = profile.length - 1;
  const labels: SegmentKind[] = [];
  for (let i = 0; i < n; i++) {
    const g = ((profile[i + 1].ele - profile[i].ele) / ((profile[i + 1].km - profile[i].km) * 1000)) * 100;
    labels.push(g >= options.gradeThreshold ? "climb" : g <= -options.gradeThreshold ? "descent" : "flat");
  }
  let runs: Run[] = labels.map((kind, i) => ({ kind, from: i, to: i + 1 }));
  runs = absorbShort(profile, runs, options.minLengthM);

  runs = runs.map((r) => {
    const net = profile[r.to].ele - profile[r.from].ele;
    if (r.kind === "climb" && net < options.minNetM) return { ...r, kind: "flat" as const };
    if (r.kind === "descent" && -net < options.minNetM) return { ...r, kind: "flat" as const };
    return r;
  });
  runs = absorbShort(profile, runs, options.minLengthM);

  return runs.map((r) => {
    let gain = 0;
    let loss = 0;
    for (let i = r.from; i < r.to; i++) {
      const d = profile[i + 1].ele - profile[i].ele;
      if (d > 0) gain += d;
      else loss -= d;
    }
    const startKm = profile[r.from].km;
    const endKm = profile[r.to].km;
    return {
      kind: r.kind,
      startKm,
      endKm,
      lengthKm: endKm - startKm,
      startEle: profile[r.from].ele,
      endEle: profile[r.to].ele,
      gain,
      loss,
      avgGrade: ((profile[r.to].ele - profile[r.from].ele) / ((endKm - startKm) * 1000)) * 100,
    };
  });
}
