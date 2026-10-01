import type { EffortTag, Plan, TrackSample } from "@/lib/planner";

/** "4:45" + seconds as a 12 hour clock, without depending on the viewer's locale. */
export function clockAt(start: string, seconds: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = Math.round((h || 0) * 3600 + (m || 0) * 60 + seconds);
  const hh = Math.floor(total / 3600) % 24;
  const mm = Math.floor((total % 3600) / 60);
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
}

function indexAt(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function paceAt(plan: Plan, km: number): number {
  const i = Math.min(indexAt(plan.timeline.km, km), plan.timeline.paceSecPerKm.length - 1);
  return plan.timeline.paceSecPerKm[i];
}

export function pointAt(track: TrackSample[], km: number): [number, number] {
  if (km <= 0) return [track[0].lon, track[0].lat];
  const last = track[track.length - 1];
  if (km >= last.km) return [last.lon, last.lat];
  const i = indexAt(track.map((t) => t.km), km);
  const a = track[i];
  const b = track[i + 1];
  const f = b.km > a.km ? (km - a.km) / (b.km - a.km) : 0;
  return [a.lon + (b.lon - a.lon) * f, a.lat + (b.lat - a.lat) * f];
}

export function trackUntil(track: TrackSample[], km: number): [number, number][] {
  const out: [number, number][] = [];
  for (const t of track) {
    if (t.km > km) break;
    out.push([t.lon, t.lat]);
  }
  out.push(pointAt(track, km));
  return out;
}

export const TAG_LABEL: Record<EffortTag, string> = {
  hold: "Hold back",
  cruise: "Steady",
  recover: "Recover",
  push: "Push",
};

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "race-plan";
}
