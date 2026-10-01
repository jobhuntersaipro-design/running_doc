import type { StationKind } from "@/lib/planner/types";

/** Shared by the admin forms and the server actions that check them. */

export interface FormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export const DISTANCES = [
  { value: "10k", label: "10K", km: 10 },
  { value: "half", label: "Half marathon", km: 21.0975 },
  { value: "full", label: "Marathon", km: 42.195 },
  { value: "custom", label: "Other distance", km: 0 },
] as const;

export type DistanceValue = (typeof DISTANCES)[number]["value"];

export const STATION_KINDS: { value: StationKind; label: string }[] = [
  { value: "water", label: "Water" },
  { value: "isotonic", label: "Isotonic" },
  { value: "gel", label: "Gel" },
  { value: "banana", label: "Banana" },
  { value: "splash", label: "Splash" },
  { value: "medic", label: "Medic" },
];

const MB = 1024 * 1024;
export const LIMITS = {
  gpx: 1.5 * MB,
  pdf: 2.5 * MB,
  cover: 2 * MB,
  /** Vercel rejects request bodies over 4.5 MB; leave room for the form fields. */
  total: 4.3 * MB,
};

export function formatMb(bytes: number) {
  return `${(bytes / MB).toFixed(1)} MB`;
}
