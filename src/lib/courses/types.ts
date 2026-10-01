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
