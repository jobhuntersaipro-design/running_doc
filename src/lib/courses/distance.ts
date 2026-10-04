const near = (km: number, target: number) => Math.abs(km - target) / target < 0.02;

/** "5K", "10K", "15K", "21K", "42K": the short name runners use on bibs and ribbons. */
export function shortDistance(km: number): string {
  if (near(km, 21.0975)) return "21K";
  if (near(km, 42.195)) return "42K";
  const r = Math.round(km * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}K`;
}

/** "5K", "10K", "Half marathon", "Full marathon": the name on a distance tab. */
export function distanceName(km: number): string {
  if (near(km, 21.0975)) return "Half marathon";
  if (near(km, 42.195)) return "Full marathon";
  return shortDistance(km);
}

const simpleName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Same race: same day, same distance (within 0.5 km) and one event name contains the other ("KL Marathon" and "Standard Chartered KL Marathon"). */
export function sameRace(a: { event: string; date?: string; km: number }, b: { event: string; date?: string; km: number }): boolean {
  const [x, y] = [simpleName(a.event), simpleName(b.event)];
  return Boolean(a.date) && a.date === b.date && Math.abs(a.km - b.km) < 0.5 && Boolean(x && y) && (x.includes(y) || y.includes(x));
}
