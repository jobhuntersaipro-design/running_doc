/** What a signed-in runner tells us about themselves. Every field is optional. */
export interface RunnerProfile {
  age: number | null;
  sex: "female" | "male" | null;
  heightCm: number | null;
  weightKg: number | null;
  /** ml/kg/min, from a watch or a lab test. */
  vo2max: number | null;
}

export const EMPTY_PROFILE: RunnerProfile = { age: null, sex: null, heightCm: null, weightKg: null, vo2max: null };

/** Accepted range of each number, inclusive. */
export const PROFILE_LIMITS = {
  age: [12, 90],
  heightCm: [120, 230],
  weightKg: [30, 200],
  vo2max: [20, 90],
} as const;

const optionalIn = (v: unknown, [min, max]: readonly [number, number]) =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);

/** Checks a profile read from storage or sent by a browser. */
export function isRunnerProfile(v: unknown): v is RunnerProfile {
  const p = v as RunnerProfile;
  return (
    !!p &&
    optionalIn(p.age, PROFILE_LIMITS.age) &&
    optionalIn(p.heightCm, PROFILE_LIMITS.heightCm) &&
    optionalIn(p.weightKg, PROFILE_LIMITS.weightKg) &&
    optionalIn(p.vo2max, PROFILE_LIMITS.vo2max) &&
    (p.sex === null || p.sex === "female" || p.sex === "male")
  );
}

/** Max heart rate from age: Gulati (206 - 0.88 x age) for women, Tanaka (208 - 0.7 x age) otherwise. */
export function maxHrFromAge(age: number, sex: RunnerProfile["sex"]): number {
  return Math.round(sex === "female" ? 206 - 0.88 * age : 208 - 0.7 * age);
}

/** Oxygen cost (ml/kg/min) of running at a speed in m/min, after Daniels and Gilbert. */
const oxygenCost = (metresPerMin: number) => -4.6 + 0.182258 * metresPerMin + 0.000104 * metresPerMin ** 2;

/** The speed (m/min) whose oxygen cost is this much. */
const speedFor = (vo2: number) => (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.6))) / (2 * 0.000104);

/** Threshold pace (sec/km) from VO2 max: the pace at 88% of it, Jack Daniels' T pace. */
export function thresholdFromVo2max(vo2max: number): number {
  return 60000 / speedFor(0.88 * vo2max);
}

/** Share of VO2 max that running at this pace (sec/km) takes. */
export function vo2maxShare(paceSecPerKm: number, vo2max: number): number {
  return oxygenCost(60000 / paceSecPerKm) / vo2max;
}

/** Share of max heart rate for a share of VO2 max (Swain et al.: %HRmax = 0.64 x %VO2max + 37). */
export function hrShareFromVo2Share(share: number): number {
  return Math.min(0.97, Math.max(0.6, 0.6463 * share + 0.37182));
}

/** Energy used running this far, at about 1 kcal per kg per km. */
export function energyKcal(weightKg: number, km: number): number {
  return Math.round(weightKg * km);
}

/** A goal a runner saved for one race: finish time, start time and when they saved it. */
export interface SavedGoal {
  goalSeconds: number;
  /** "HH:MM", 24 hour. */
  startTime: string;
  /** ISO date. */
  savedAt: string;
}

/** Checks a saved goal read from storage or sent by a browser. */
export function isSavedGoal(v: unknown): v is SavedGoal {
  const g = v as SavedGoal;
  return (
    !!g &&
    Number.isInteger(g.goalSeconds) &&
    g.goalSeconds >= 600 &&
    g.goalSeconds < 36000 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(String(g.startTime)) &&
    !Number.isNaN(Date.parse(String(g.savedAt)))
  );
}
