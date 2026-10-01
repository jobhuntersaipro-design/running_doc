import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import { buildPlan, buildProfile, buildSegments, formatClock, formatPace, gradeMultiplier, parseDuration, parseGpx } from "./index";

/** A straight north-south track, one point roughly every 100 m. */
function syntheticGpx(km: number, ele: (km: number) => number): string {
  const step = 0.0009; // ~100 m of latitude
  const n = Math.round((km * 1000) / 100);
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    return `<trkpt lat="${(i * step).toFixed(6)}" lon="101.0"><ele>${ele((i * 100) / 1000)}</ele></trkpt>`;
  });
  return `<gpx><trk><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
}

describe("gpx", () => {
  it("parses track points and ignores waypoints", () => {
    const xml = `<gpx><wpt lat="1" lon="1"><ele>5</ele></wpt><trk><trkseg>
      <trkpt lat="3.1" lon="101.6"><ele>30</ele></trkpt>
      <trkpt lat="3.2" lon="101.7"><ele>31.5</ele></trkpt></trkseg></trk></gpx>`;
    expect(parseGpx(xml)).toEqual([
      { lat: 3.1, lon: 101.6, ele: 30 },
      { lat: 3.2, lon: 101.7, ele: 31.5 },
    ]);
  });

  it("rejects tracks without elevation", () => {
    const xml = `<gpx><trk><trkseg><trkpt lat="1" lon="1"></trkpt><trkpt lat="2" lon="1"></trkpt></trkseg></trk></gpx>`;
    expect(() => parseGpx(xml)).toThrow(/elevation/);
  });
});

describe("gradeMultiplier", () => {
  it("is 1 on the flat, slower uphill, quicker downhill", () => {
    expect(gradeMultiplier(0)).toBeCloseTo(1, 5);
    expect(gradeMultiplier(5)).toBeGreaterThan(1.1);
    expect(gradeMultiplier(5)).toBeLessThan(1.25);
    expect(gradeMultiplier(-5)).toBeLessThan(1);
  });

  it("gains less on a downhill than it loses on the matching uphill", () => {
    expect(1 - gradeMultiplier(-4)).toBeLessThan(gradeMultiplier(4) - 1);
  });
});

describe("profile and segments", () => {
  it("rescales distance to the official length", () => {
    const profile = buildProfile(parseGpx(syntheticGpx(10, () => 20)), 9.5);
    expect(profile[profile.length - 1].km).toBeCloseTo(9.5, 6);
  });

  it("finds a single hill and ignores noise", () => {
    // flat 0-3 km, 6% climb 3-4 km, flat 4-8 km, with +/-1 m jitter
    const ele = (km: number) =>
      20 + (km < 3 ? 0 : km < 4 ? (km - 3) * 60 : 60) + (Math.round(km * 10) % 2 ? 1 : 0);
    const profile = buildProfile(parseGpx(syntheticGpx(8, ele)), 8);
    const segments = buildSegments(profile);
    const climbs = segments.filter((s) => s.kind === "climb");
    expect(climbs).toHaveLength(1);
    expect(climbs[0].startKm).toBeGreaterThan(2.3);
    expect(climbs[0].endKm).toBeLessThan(4.7);
    expect(climbs[0].gain).toBeGreaterThan(45);
    expect(segments.filter((s) => s.kind === "descent")).toHaveLength(0);
  });
});

describe("plan on a flat course", () => {
  const plan = buildPlan({
    name: "flat 10k",
    gpx: syntheticGpx(10, () => 20),
    officialKm: 10,
    goalSeconds: 3000,
    stations: [{ km: 5, kinds: ["water"] }],
  });

  it("hits the goal time exactly", () => {
    expect(plan.splits[plan.splits.length - 1].cumulativeSeconds).toBeCloseTo(3000, 5);
  });

  it("starts slower and finishes faster than the middle", () => {
    const first = plan.splits[0].paceSecPerKm;
    const mid = plan.splits[5].paceSecPerKm;
    const last = plan.splits[9].paceSecPerKm;
    expect(first).toBeGreaterThan(mid);
    expect(last).toBeLessThan(mid);
  });

  it("plans no gels for a short race", () => {
    expect(plan.events.some((e) => e.type === "gel")).toBe(false);
  });
});

describe("KLSCM 2026 half marathon", () => {
  const gpx = readFileSync(course.gpxPath, "utf8");
  const make = (goal: string) =>
    buildPlan({
      name: course.name,
      gpx,
      officialKm: course.officialKm,
      goalSeconds: parseDuration(goal),
      stations: course.stations,
    });
  const plan = make("1:59:00");

  it("covers 22 splits, the last one short", () => {
    expect(plan.splits).toHaveLength(22);
    expect(plan.splits[21].lengthKm).toBeCloseTo(0.0975, 4);
    expect(plan.splits[21].endKm).toBeCloseTo(21.0975, 4);
  });

  it("finishes at the goal with a gentle negative split", () => {
    expect(plan.splits[21].cumulativeSeconds).toBeCloseTo(7140, 3);
    expect(plan.summary.secondHalfSeconds).toBeLessThan(plan.summary.firstHalfSeconds);
  });

  it("detects the two big climbs", () => {
    const climbs = plan.segments.filter((s) => s.kind === "climb" && s.gain >= 30);
    expect(climbs.some((c) => c.startKm < 3 && c.endKm > 4)).toBe(true);
    expect(climbs.some((c) => c.startKm > 7 && c.endKm < 9.5)).toBe(true);
  });

  it("slows on climbs and eases the start", () => {
    const goalPace = plan.summary.goalPaceSecPerKm;
    expect(plan.splits[0].paceSecPerKm).toBeGreaterThan(goalPace);
    expect(plan.splits[8].paceSecPerKm).toBeGreaterThan(goalPace + 15);
  });

  it("plans two gels, none on a climb, each before a drink station", () => {
    const gels = plan.events.filter((e) => e.type === "gel");
    expect(gels).toHaveLength(2);
    for (const g of gels) {
      const onClimb = plan.segments.some((s) => s.kind === "climb" && g.km > s.startKm && g.km < s.endKm);
      expect(onClimb).toBe(false);
      expect(plan.events.some((e) => e.type === "drink" && e.km > g.km && e.km - g.km < 1)).toBe(true);
    }
    expect(gels[1].elapsedSeconds - gels[0].elapsedSeconds).toBeGreaterThan(30 * 60);
  });

  it("lists a drink event for every water or isotonic station", () => {
    const expected = course.stations.filter((s) => s.kinds.some((k) => k === "water" || k === "isotonic"));
    expect(plan.events.filter((e) => e.type === "drink")).toHaveLength(expected.length);
  });

  it("keeps cumulative time strictly increasing and attaches events to splits", () => {
    for (let i = 1; i < plan.splits.length; i++) {
      expect(plan.splits[i].cumulativeSeconds).toBeGreaterThan(plan.splits[i - 1].cumulativeSeconds);
    }
    const attached = plan.splits.flatMap((s) => s.events).length;
    expect(attached).toBe(plan.events.length);
  });

  it("scales with the goal time", () => {
    const slower = make("2:30:00");
    expect(slower.splits[21].cumulativeSeconds).toBeCloseTo(9000, 3);
    expect(slower.splits[10].paceSecPerKm).toBeGreaterThan(plan.splits[10].paceSecPerKm);
  });
});

describe("format", () => {
  it("formats and parses durations", () => {
    expect(formatPace(341.4)).toBe("5:41");
    expect(formatClock(7140)).toBe("1:59:00");
    expect(parseDuration("1:59:30")).toBe(7170);
    expect(parseDuration("59:30")).toBe(3570);
    expect(() => parseDuration("abc")).toThrow();
  });
});
