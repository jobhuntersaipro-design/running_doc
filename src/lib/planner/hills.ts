import type { HillInfo, ProfileSample, Segment } from "./types";

/** Uphills and downhills smaller than this (metres) are not worth a callout. */
export const MIN_HILL_M = 10;

/**
 * Treadmill incline that feels like a road gradient. A treadmill belt has no
 * air resistance, and about 1% incline makes up for that at everyday running
 * speeds (Jones and Doust, 1996). Rounded to the 0.5% steps most treadmills use.
 */
export function treadmillIncline(roadGradePct: number): number {
  return Math.max(1, Math.round((roadGradePct + 1) * 2) / 2);
}

/** Describes a segment from its start to its peak (or bottom), where the real hill is. */
/**
 * Gradient over the core of a hill, between 10% and 90% of its rise. Smoothing
 * stretches a hill's ends, so start-to-peak would understate how steep it is.
 */
function coreGrade(profile: ProfileSample[], segment: Segment): number {
  const rise = segment.peakEle - segment.startEle;
  const inHill = profile.filter((p) => p.km >= segment.startKm - 1e-9 && p.km <= segment.peakKm + 1e-9);
  const crosses = (fraction: number) => {
    const target = segment.startEle + rise * fraction;
    for (let i = 1; i < inHill.length; i++) {
      const a = inHill[i - 1];
      const b = inHill[i];
      if ((b.ele - target) * Math.sign(rise) >= 0 && (a.ele - target) * Math.sign(rise) < 0) {
        return a.km + ((target - a.ele) / (b.ele - a.ele)) * (b.km - a.km);
      }
    }
    return null;
  };
  const from = crosses(0.1);
  const to = crosses(0.9);
  if (from === null || to === null || to - from < 0.05) {
    return (rise / (Math.max(0.1, segment.peakKm - segment.startKm) * 1000)) * 100;
  }
  return ((rise * 0.8) / ((to - from) * 1000)) * 100;
}

export function hillInfo(
  segment: Segment,
  profile: ProfileSample[],
  paceBetween: (fromKm: number, toKm: number) => number,
): HillInfo | null {
  if (segment.kind === "flat") return null;
  const up = segment.kind === "uphill";
  const change = up ? segment.peakEle - segment.startEle : segment.startEle - segment.peakEle;
  if (change < MIN_HILL_M) return null;
  const toPeakKm = Math.max(0.1, segment.peakKm - segment.startKm);
  const avgGrade = coreGrade(profile, segment);
  return {
    kind: segment.kind,
    startKm: segment.startKm,
    endKm: segment.startKm + toPeakKm,
    lengthKm: toPeakKm,
    startEle: segment.startEle,
    peakEle: segment.peakEle,
    peakKm: segment.peakKm,
    change,
    avgGrade,
    steepestGrade: segment.steepestGrade,
    paceSecPerKm: paceBetween(segment.startKm, segment.startKm + toPeakKm),
    treadmillIncline: up ? treadmillIncline(avgGrade) : null,
  };
}
