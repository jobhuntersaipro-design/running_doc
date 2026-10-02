import type { Station } from "../planner/types";
import type { RaceMeta } from "./types";

/**
 * Standard Chartered KL Marathon 2026: the 5K, 10K and full marathon. The half
 * marathon is in klscm-2026-hm.ts. Courses are the organiser's plotaroute GPX
 * files; station distances were read by eye from the official route maps
 * (+/- 0.5 km), so check them against the runners' guide.
 */
const event = {
  event: "Standard Chartered KL Marathon 2026",
  location: "Kuala Lumpur, Malaysia",
  officialUrl: "https://www.kl-marathon.com",
  stationsApproximate: true,
} as const;

const files = (id: string) => [
  { label: "Course GPX", href: `/races/${id}/course.gpx`, kind: "gpx" as const },
  { label: "Official route map (PDF)", href: `/races/${id}/route-map.pdf`, kind: "pdf" as const },
];

export const klscm2026_5k = {
  ...event,
  id: "klscm-2026-5k",
  name: "KL Marathon 2026, 5K",
  category: "5KM Fun Run",
  dateLabel: "Saturday 3 October 2026",
  date: "2026-10-03",
  files: files("klscm-2026-5k"),
  officialKm: 5,
  startTime: "07:45",
  gpxPath: "public/races/klscm-2026-5k/course.gpx",
  stations: [{ km: 2, kinds: ["water", "isotonic", "medic"] }] satisfies Station[],
} satisfies RaceMeta;

export const klscm2026_10k = {
  ...event,
  id: "klscm-2026-10k",
  name: "KL Marathon 2026, 10K",
  category: "IHH 10KM",
  dateLabel: "Saturday 3 October 2026",
  date: "2026-10-03",
  files: files("klscm-2026-10k"),
  officialKm: 10,
  startTime: "06:00",
  gpxPath: "public/races/klscm-2026-10k/course.gpx",
  stations: [
    { km: 2.6, kinds: ["water", "isotonic", "medic"] },
    { km: 5, kinds: ["water", "medic"] },
    { km: 7, kinds: ["water", "isotonic", "medic"] },
  ] satisfies Station[],
} satisfies RaceMeta;

export const klscm2026Fm = {
  ...event,
  id: "klscm-2026-fm",
  name: "KL Marathon 2026, full marathon",
  category: "Full Marathon",
  dateLabel: "Sunday 4 October 2026",
  date: "2026-10-04",
  files: files("klscm-2026-fm"),
  officialKm: 42.195,
  startTime: "03:30",
  // Checkpoints close at 7:25 (km 20), 8:15 (km 25), 10:00 (km 35) and 10:35 (km 40.5); the finish is the tightest.
  cutoff: { km: 42, clock: "10:45" },
  gpxPath: "public/races/klscm-2026-fm/course.gpx",
  stations: [
    { km: 4.5, kinds: ["water", "isotonic", "medic"] },
    { km: 7.5, kinds: ["water", "medic"] },
    { km: 10, kinds: ["water", "isotonic", "medic", "surau"] },
    { km: 12.3, kinds: ["water", "medic"] },
    { km: 14, kinds: ["water", "isotonic", "medic"] },
    { km: 16, kinds: ["water", "medic"] },
    { km: 18, kinds: ["water", "isotonic", "splash", "medic"] },
    { km: 20, kinds: ["water", "medic", "rub"] },
    { km: 22.5, kinds: ["water", "isotonic", "banana", "medic"] },
    { km: 25, kinds: ["water", "medic", "splash"] },
    { km: 27, kinds: ["water", "isotonic", "gel", "medic"] },
    { km: 29, kinds: ["water", "medic", "splash", "rub"] },
    { km: 31, kinds: ["water", "isotonic", "medic"] },
    { km: 33, kinds: ["water", "medic", "splash", "rub"] },
    { km: 35, kinds: ["water", "isotonic", "banana", "medic"] },
    { km: 36.5, kinds: ["water", "gel", "splash", "medic", "rub"] },
    { km: 39, kinds: ["water", "isotonic", "medic"] },
    { km: 41, kinds: ["water", "medic"] },
  ] satisfies Station[],
} satisfies RaceMeta;
