import { interpolate } from "./profile";
import type { ProfileSample, Timeline } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Pace multiplier for a gradient (percent), where 1 means flat pace.
 * Based on Minetti's energy cost of running, dampened so it tracks real-world
 * grade-adjusted pace (about +16% at 5% uphill). Beginners also gain less from
 * downhills than the model suggests, so the downhill gain is halved.
 */
export function gradeMultiplier(gradePct: number): number {
  const i = clamp(gradePct / 100, -0.12, 0.15);
  const cost = 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  let m = 1 + (cost / 3.6 - 1) * 0.55;
  if (gradePct < 0) m = 1 + (m - 1) * 0.5;
  return clamp(m, 0.9, 1.6);
}

export interface PacingOptions {
  /** Extra time (fraction) added at the very start, easing to zero. */
  startHoldback: number;
  /** Distance over which the start holdback fades out, km. */
  startFadeKm: number;
  /** Time (fraction) taken off over the final stretch for a controlled finish. */
  finishLift: number;
  finishLiftKm: number;
}

export const DEFAULT_PACING: PacingOptions = {
  startHoldback: 0.03,
  startFadeKm: 3,
  finishLift: 0.015,
  finishLiftKm: 3,
};

/**
 * Spreads the goal time over the course: slower on climbs, a little faster on
 * descents, a deliberately easy start and a slightly quicker finish, all
 * normalised so the total equals the goal exactly.
 */
export function buildTimeline(
  profile: ProfileSample[],
  goalSeconds: number,
  options: PacingOptions = DEFAULT_PACING,
): Timeline {
  const totalKm = profile[profile.length - 1].km;
  const n = profile.length - 1;
  const mult: number[] = [];
  const len: number[] = [];

  for (let i = 0; i < n; i++) {
    const lenKm = profile[i + 1].km - profile[i].km;
    const mid = profile[i].km + lenKm / 2;
    const grade = ((profile[i + 1].ele - profile[i].ele) / (lenKm * 1000)) * 100;
    const start =
      mid < options.startFadeKm ? 1 + options.startHoldback * (1 - mid / options.startFadeKm) : 1;
    const remaining = totalKm - mid;
    const finish =
      remaining < options.finishLiftKm
        ? 1 - options.finishLift * (1 - remaining / options.finishLiftKm)
        : 1;
    mult.push(gradeMultiplier(grade) * start * finish);
    len.push(lenKm);
  }

  const weighted = mult.reduce((sum, m, i) => sum + m * len[i], 0);
  const base = goalSeconds / weighted;

  const t = [0];
  const pace: number[] = [];
  for (let i = 0; i < n; i++) {
    pace.push(base * mult[i]);
    t.push(t[i] + pace[i] * len[i]);
  }
  return { km: profile.map((p) => p.km), t, paceSecPerKm: pace };
}

export function timeAt(timeline: Timeline, km: number): number {
  return interpolate(timeline.km, timeline.t, km);
}

export function kmAtTime(timeline: Timeline, seconds: number): number {
  return interpolate(timeline.t, timeline.km, seconds);
}
