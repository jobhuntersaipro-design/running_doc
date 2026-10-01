import type { ProfileSample, TrackPoint } from "./types";

const EARTH_RADIUS_M = 6371000;

export function haversineM(a: TrackPoint, b: TrackPoint): number {
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin((lb - la) / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Resamples the track every `stepM` metres. Distances are rescaled so the track
 * ends exactly at `officialKm` (plotted GPX files are usually a little long).
 * Elevation is smoothed because raw GPX elevation is noisy and low resolution.
 */
export function buildProfile(
  points: TrackPoint[],
  officialKm: number,
  stepM = 100,
  smoothHalfWindow = 3,
): ProfileSample[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  }
  const totalM = officialKm * 1000;
  const scale = totalM / cum[cum.length - 1];
  const dist = cum.map((d) => d * scale);

  const n = Math.ceil(totalM / stepM);
  const xs: number[] = [];
  const raw: number[] = [];
  const lat: number[] = [];
  const lon: number[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const x = Math.min(i * stepM, totalM);
    while (j < dist.length - 2 && dist[j + 1] < x) j++;
    const span = dist[j + 1] - dist[j];
    const f = span > 0 ? Math.min(1, Math.max(0, (x - dist[j]) / span)) : 0;
    xs.push(x);
    raw.push(points[j].ele + (points[j + 1].ele - points[j].ele) * f);
    lat.push(points[j].lat + (points[j + 1].lat - points[j].lat) * f);
    lon.push(points[j].lon + (points[j + 1].lon - points[j].lon) * f);
  }

  const ele = raw.map((_, i) => {
    const lo = Math.max(0, i - smoothHalfWindow);
    const hi = Math.min(n, i + smoothHalfWindow);
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += raw[k];
    return sum / (hi - lo + 1);
  });

  return ele.map((e, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(n, i + 1);
    return {
      km: xs[i] / 1000,
      lat: lat[i],
      lon: lon[i],
      ele: e,
      grade: ((ele[hi] - ele[lo]) / (xs[hi] - xs[lo])) * 100,
    };
  });
}

/** Linear interpolation of a value that is sampled along the course. */
export function interpolate(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + (ys[hi] - ys[lo]) * f;
}

export function elevationAt(profile: ProfileSample[], km: number): number {
  return interpolate(
    profile.map((p) => p.km),
    profile.map((p) => p.ele),
    km,
  );
}
