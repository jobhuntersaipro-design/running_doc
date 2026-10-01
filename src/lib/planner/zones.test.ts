import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import {
  DEFAULT_ZONE_SETTINGS,
  averageHr,
  buildPlan,
  courseZones,
  estimateThresholdPace,
  hrZoneFor,
  hrZones,
  paceZoneFor,
  paceZones,
} from "./index";

describe("heart rate zones", () => {
  it("uses % of max HR by default", () => {
    const z = hrZones({ ...DEFAULT_ZONE_SETTINGS.hr, maxHr: 200 });
    expect(z.map((x) => x.min)).toEqual([100, 120, 140, 160, 180]);
    expect(z[4].max).toBe(200);
    expect(z[0].max).toBe(119);
  });

  it("uses heart rate reserve when asked", () => {
    const z = hrZones({ ...DEFAULT_ZONE_SETTINGS.hr, maxHr: 190, restingHr: 50, method: "reserve" });
    expect(z[3].min).toBe(162); // 50 + 0.8 x 140
  });

  it("accepts custom zone starts in any order", () => {
    const z = hrZones({ ...DEFAULT_ZONE_SETTINGS.hr, method: "custom", customStarts: [150, 100, 130, 165, 115] });
    expect(z.map((x) => x.min)).toEqual([100, 115, 130, 150, 165]);
    expect(hrZoneFor(z, 155)).toBe(4);
    expect(hrZoneFor(z, 90)).toBe(1);
  });
});

describe("pace zones", () => {
  it("are relative to threshold pace", () => {
    const t = 300; // 5:00/km
    expect(paceZoneFor(t, 400)).toBe(1);
    expect(paceZoneFor(t, 360)).toBe(2);
    expect(paceZoneFor(t, 330)).toBe(3);
    expect(paceZoneFor(t, 305)).toBe(4);
    expect(paceZoneFor(t, 280)).toBe(5);
    const zones = paceZones(t);
    expect(zones[0].slowest).toBe(Infinity);
    expect(zones[4].fastest).toBe(0);
    expect(zones[3].slowest).toBeCloseTo(318);
  });

  it("estimates threshold a little faster than half marathon pace", () => {
    const t = estimateThresholdPace(7140, 21.0975);
    expect(t).toBeLessThan(7140 / 21.0975);
    expect(t).toBeGreaterThan(7140 / 21.0975 - 30);
  });
});

describe("course zones", () => {
  const plan = buildPlan({
    name: course.name,
    gpx: readFileSync(course.gpxPath, "utf8"),
    officialKm: course.officialKm,
    goalSeconds: 7140,
    stations: course.stations,
  });
  const zones = courseZones(plan, DEFAULT_ZONE_SETTINGS);

  it("covers the course with readable stretches", () => {
    for (const runs of [zones.paceRuns, zones.hrRuns]) {
      expect(runs[0].startKm).toBe(0);
      expect(runs.at(-1)!.endKm).toBeCloseTo(course.officialKm, 6);
      runs.forEach((r, i) => i > 0 && expect(r.startKm).toBe(runs[i - 1].endKm));
    }
    expect(zones.paceRuns.every((r) => r.endKm - r.startKm >= 0.4 - 1e-9)).toBe(true);
  });

  it("splits race time across zones that add up to the goal", () => {
    expect(zones.paceSeconds.reduce((a, b) => a + b, 0)).toBeCloseTo(7140, 0);
    expect(zones.hrSeconds.reduce((a, b) => a + b, 0)).toBeCloseTo(7140, 0);
  });

  it("estimates heart rate rising on climbs and over the race", () => {
    expect(averageHr(zones, 3, 4)).toBeGreaterThan(averageHr(zones, 0, 1));
    expect(averageHr(zones, 20, 21)).toBeGreaterThan(averageHr(zones, 11, 12));
    expect(averageHr(zones, 0, course.officialKm)).toBeLessThanOrEqual(DEFAULT_ZONE_SETTINGS.hr.maxHr);
  });

  it("uses a threshold pace the runner enters", () => {
    const own = courseZones(plan, { ...DEFAULT_ZONE_SETTINGS, thresholdPace: 300 });
    expect(own.thresholdEstimated).toBe(false);
    expect(own.thresholdPace).toBe(300);
    // Slower than goal pace, so a faster threshold puts most of the race in lower zones.
    expect(own.paceSeconds[2] + own.paceSeconds[1]).toBeGreaterThan(zones.paceSeconds[2] + zones.paceSeconds[1]);
  });
});
