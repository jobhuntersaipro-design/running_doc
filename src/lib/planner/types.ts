export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

/** One sample every `stepM` metres along the (distance-normalised) course. */
export interface ProfileSample {
  km: number;
  /** Smoothed elevation in metres. */
  ele: number;
  /** Smoothed gradient in percent. */
  grade: number;
}

export type SegmentKind = "climb" | "descent" | "flat";

export interface Segment {
  kind: SegmentKind;
  startKm: number;
  endKm: number;
  lengthKm: number;
  startEle: number;
  endEle: number;
  /** Total ascent inside the segment, metres. */
  gain: number;
  /** Total descent inside the segment, metres (positive number). */
  loss: number;
  avgGrade: number;
}

export type StationKind =
  | "water"
  | "isotonic"
  | "gel"
  | "banana"
  | "splash"
  | "medic"
  | "rub"
  | "surau";

export interface Station {
  km: number;
  kinds: StationKind[];
  label?: string;
}

export type EffortTag = "hold" | "cruise" | "push" | "recover";

export type EventType =
  | "start"
  | "gel"
  | "drink"
  | "cool"
  | "banana"
  | "climb"
  | "descent"
  | "push";

export interface PlanEvent {
  type: EventType;
  km: number;
  elapsedSeconds: number;
  title: string;
  detail: string;
}

export interface Split {
  /** 1-based kilometre number. */
  km: number;
  startKm: number;
  endKm: number;
  lengthKm: number;
  paceSecPerKm: number;
  splitSeconds: number;
  cumulativeSeconds: number;
  /** Net gradient over the kilometre, percent. */
  avgGrade: number;
  tag: EffortTag;
  events: PlanEvent[];
}

export interface Timeline {
  /** Distance at each sample boundary, km. */
  km: number[];
  /** Cumulative seconds at each sample boundary. */
  t: number[];
  /** Pace for the interval after each boundary, sec/km. */
  paceSecPerKm: number[];
}

export interface PlanSummary {
  goalSeconds: number;
  goalPaceSecPerKm: number;
  totalKm: number;
  totalGain: number;
  totalLoss: number;
  firstHalfSeconds: number;
  secondHalfSeconds: number;
  gelCount: number;
  biggestClimb: Segment | null;
}

export interface Plan {
  name: string;
  profile: ProfileSample[];
  segments: Segment[];
  splits: Split[];
  events: PlanEvent[];
  summary: PlanSummary;
}
