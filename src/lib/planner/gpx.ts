import type { TrackPoint } from "./types";

function attr(source: string, name: string): number | null {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]+)"`).exec(source);
  return m ? Number(m[1]) : null;
}

/** Reads track points from a GPX string. Waypoints and routes are ignored. */
export function parseGpx(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const re = /<trkpt([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = attr(m[1], "lat");
    const lon = attr(m[1], "lon");
    const ele = /<ele>\s*([^<\s]+)\s*<\/ele>/.exec(m[2]);
    if (lat === null || lon === null || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    points.push({ lat, lon, ele: ele ? Number(ele[1]) : NaN });
  }
  if (points.length < 2) throw new Error("GPX has fewer than two track points");
  if (points.some((p) => Number.isNaN(p.ele))) {
    throw new Error("GPX track points are missing elevation");
  }
  return points;
}
