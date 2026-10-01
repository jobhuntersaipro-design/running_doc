import type { Station } from "../planner/types";

/**
 * Example course: Standard Chartered KL Marathon 2026, ASICS Half Marathon.
 *
 * Station distances were read by eye from the official route map, so they are
 * approximate (+/- 0.5 km). Check them against the race technical guide before
 * relying on them.
 */
export const klscm2026Hm = {
  id: "klscm-2026-hm",
  name: "KL Marathon 2026, half marathon",
  officialKm: 21.0975,
  startTime: "04:45",
  cutoff: { km: 17, clock: "07:50" },
  gpxPath: "data/klscm-2026-hm/course.gpx",
  stationsApproximate: true,
  stations: [
    { km: 4.5, kinds: ["isotonic", "water", "medic"] },
    { km: 6, kinds: ["isotonic", "medic"] },
    { km: 7.5, kinds: ["water", "medic"] },
    { km: 9.5, kinds: ["water", "surau"] },
    { km: 11, kinds: ["gel"] },
    { km: 12.5, kinds: ["water", "medic"] },
    { km: 14, kinds: ["isotonic", "water", "banana", "medic"] },
    { km: 16, kinds: ["water", "medic"] },
    { km: 19.5, kinds: ["isotonic", "splash", "medic", "rub"] },
    { km: 20.5, kinds: ["water", "medic"] },
  ] satisfies Station[],
};
