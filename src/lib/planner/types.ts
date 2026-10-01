export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

/** An original GPX point with its distance along the course, for drawing the route. */
export interface TrackSample {
  lat: number;
  lon: number;
  km: number;
}

/** One sample every `stepM` metres along the (distance-normalised) course. */
export interface ProfileSample {
  km: number;
  lat: number;
  lon: number;
  /** Smoothed elevation in metres. */
  ele: number;
  /** Smoothed gradient in percent. */
  grade: number;
}

export type SegmentKind = "uphill" | "downhill" | "flat";

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
  /** Highest point of an uphill, lowest point of a downhill (the start point for flats). */
  peakKm: number;
  peakEle: number;
  /** Steepest smoothed gradient inside the segment, percent (negative for downhills). */
  steepestGrade: number;
}

/** What a runner needs to know about one uphill or downhill. */
export interface HillInfo {
  kind: "uphill" | "downhill";
  startKm: number;
  endKm: number;
  lengthKm: number;
  startEle: number;
  /** Top of an uphill, bottom of a downhill. */
  peakEle: number;
  peakKm: number;
  /** Metres gained (uphill) or lost (downhill) from the start to the peak. */
  change: number;
  /** Typical gradient over the main part of the hill, percent. */
  avgGrade: number;
  steepestGrade: number;
  /** Planned pace over the whole segment. */
  paceSecPerKm: number;
  /** Treadmill incline (percent) to practise this uphill indoors; null for downhills. */
  treadmillIncline: number | null;
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
  | "uphill"
  | "downhill"
  | "push";

export interface PlanEvent {
  type: EventType;
  km: number;
  elapsedSeconds: number;
  title: string;
  detail: string;
  hill?: HillInfo;
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

/** A run of consecutive kilometres at about the same pace, for typing into a watch. */
export interface PaceBlock {
  startKm: number;
  endKm: number;
  paceSecPerKm: number;
  label: string;
}

export interface Plan {
  name: string;
  profile: ProfileSample[];
  track: TrackSample[];
  timeline: Timeline;
  blocks: PaceBlock[];
  segments: Segment[];
  splits: Split[];
  events: PlanEvent[];
  hills: HillInfo[];
  summary: PlanSummary;
}
