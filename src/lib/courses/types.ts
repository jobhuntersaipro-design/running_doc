import type { Station } from "../planner/types";

export interface CourseInput {
  id: string;
  name: string;
  officialKm: number;
  gpx: string;
  stations: Station[];
  /** True when station distances are estimates rather than official numbers. */
  stationsApproximate?: boolean;
  /** Local start time, "HH:mm". */
  startTime?: string;
  cutoff?: { km: number; clock: string };
}

export interface RaceFile {
  label: string;
  /** Public URL of the file. */
  href: string;
  kind: "gpx" | "pdf";
}

/** A race in the overview: the course plus event details and files. */
export interface RaceMeta {
  id: string;
  name: string;
  event: string;
  category: string;
  dateLabel: string;
  location: string;
  officialUrl: string;
  files: RaceFile[];
  officialKm: number;
  /** GPX file path relative to the project root, read at build time. */
  gpxPath: string;
  stations: Station[];
  stationsApproximate?: boolean;
  startTime?: string;
  cutoff?: { km: number; clock: string };
}
