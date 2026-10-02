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
