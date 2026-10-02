import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import {
  DEFAULT_ZONE_SETTINGS,
  EMPTY_PROFILE,
  buildPlan,
  courseZones,
  energyKcal,
  formatPace,
  hrShareFromVo2Share,
  isRunnerProfile,
  isSavedGoal,
  maxHrFromAge,
  thresholdFromVo2max,
  vo2maxShare,
  withProfile,
} from "./index";
import { readFileSync } from "node:fs";

describe("runner profile", () => {
  it("accepts empty or in-range fields and rejects the rest", () => {
    expect(isRunnerProfile(EMPTY_PROFILE)).toBe(true);
    expect(isRunnerProfile({ age: 35, sex: "female", heightCm: 165, weightKg: 58, vo2max: 48 })).toBe(true);
    expect(isRunnerProfile({ ...EMPTY_PROFILE, age: 5 })).toBe(false);
    expect(isRunnerProfile({ ...EMPTY_PROFILE, sex: "other" })).toBe(false);
    expect(isRunnerProfile({ ...EMPTY_PROFILE, vo2max: "50" })).toBe(false);
  });

  it("estimates max heart rate from age, with Gulati's formula for women", () => {
    expect(maxHrFromAge(40, "male")).toBe(180); // 208 - 28
    expect(maxHrFromAge(40, null)).toBe(180);
    expect(maxHrFromAge(40, "female")).toBe(171); // 206 - 35.2
  });

  it("uses age for max heart rate only until the runner sets their own zones", () => {
    const profile = { ...EMPTY_PROFILE, age: 40 };
    expect(withProfile(DEFAULT_ZONE_SETTINGS, profile).hr.maxHr).toBe(180);
    const own = { ...DEFAULT_ZONE_SETTINGS, hr: { ...DEFAULT_ZONE_SETTINGS.hr, restingHr: 52 } };
    expect(withProfile(own, profile)).toBe(own);
    expect(withProfile(DEFAULT_ZONE_SETTINGS, EMPTY_PROFILE)).toBe(DEFAULT_ZONE_SETTINGS);
  });

  it("matches Jack Daniels' threshold pace for a VO2 max", () => {
    expect(formatPace(thresholdFromVo2max(50))).toBe("4:15"); // VDOT 50 T pace
    expect(formatPace(thresholdFromVo2max(40))).toBe("5:06"); // VDOT 40 T pace
  });

  it("puts heart rate higher when the goal pace is a bigger share of VO2 max", () => {
    const share = vo2maxShare(338, 40); // a 1:59 half marathon
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.85);
    expect(hrShareFromVo2Share(vo2maxShare(338, 40))).toBeGreaterThan(hrShareFromVo2Share(vo2maxShare(338, 55)));
    expect(hrShareFromVo2Share(2)).toBe(0.97);
  });

  it("personalises the course zones with VO2 max", () => {
    const plan = buildPlan({ name: course.name, gpx: readFileSync(course.gpxPath, "utf8"), officialKm: course.officialKm, goalSeconds: 7140, stations: course.stations });
    const typical = courseZones(plan, DEFAULT_ZONE_SETTINGS);
    const fit = courseZones(plan, DEFAULT_ZONE_SETTINGS, { ...EMPTY_PROFILE, vo2max: 60 });
    expect(typical.thresholdEstimateFrom).toBe("goal");
    expect(fit.thresholdEstimateFrom).toBe("vo2max");
    expect(fit.thresholdPace).toBeLessThan(typical.thresholdPace);
    expect(fit.intervals[50].hr).toBeLessThan(typical.intervals[50].hr);
  });

  it("estimates energy at about 1 kcal per kg per km", () => {
    expect(energyKcal(60, 21.1)).toBe(1266);
  });

  it("accepts saved goals with a sane finish time and a 24 hour start time", () => {
    const goal = { goalSeconds: 7140, startTime: "06:00", savedAt: "2026-10-02T08:00:00.000Z" };
    expect(isSavedGoal(goal)).toBe(true);
    expect(isSavedGoal({ ...goal, goalSeconds: 7140.5 })).toBe(false);
    expect(isSavedGoal({ ...goal, goalSeconds: 60 })).toBe(false);
    expect(isSavedGoal({ ...goal, startTime: "25:00" })).toBe(false);
    expect(isSavedGoal({ ...goal, savedAt: "yesterday" })).toBe(false);
  });
});
