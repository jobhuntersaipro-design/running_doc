import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import { buildPlan, dewPointC, heatSlowdown, parseGpx, parseRun, raceConditions, reviewRun } from "./index";

describe("heat", () => {
  it("works out dew point and how much slower to run", () => {
    expect(dewPointC(24, 97)).toBeCloseTo(23.5, 0);
    expect(heatSlowdown(10, 50).share).toBe(0);
    // A humid KL morning: 24 °C at 97% is about 150 °F combined, 4.5% slower.
    const kl = heatSlowdown(24, 97);
    expect(kl.share).toBeGreaterThan(0.04);
    expect(kl.share).toBeLessThan(0.05);
    expect(kl.tooHot).toBe(false);
    expect(heatSlowdown(35, 80).tooHot).toBe(true);
  });
  it("averages the hours the race runs", () => {
    const time = Array.from({ length: 24 }, (_, h) => `2026-10-04T${String(h).padStart(2, "0")}:00`);
    const w = { time, temperature: time.map((_, h) => 20 + h), humidity: time.map(() => 80) };
    expect(raceConditions(w, "05:30", 2 * 3600)).toEqual({ temp: 26, humidity: 80 }); // hours 5, 6 and 7
    expect(raceConditions({ time: [], temperature: [], humidity: [] }, "05:30", 3600)).toBeNull();
  });
});

describe("plan vs actual", () => {
  const gpx = readFileSync(`public/races/${course.id}/course.gpx`, "utf8");
  const plan = buildPlan({ name: course.name, gpx, officialKm: course.officialKm, goalSeconds: 2 * 3600, stations: course.stations });

  // A run along the course: on plan for the first half, then 10% slower.
  const points = parseGpx(gpx);
  const runGpx = (() => {
    let t = Date.parse("2026-10-04T05:30:00Z");
    let gone = 0;
    const total = plan.summary.totalKm;
    const lengths = points.map((p, i) => (i ? Math.hypot(p.lat - points[i - 1].lat, p.lon - points[i - 1].lon) : 0));
    const sum = lengths.reduce((a, b) => a + b, 0);
    const pts = points.map((p, i) => {
      gone += lengths[i];
      const km = (gone / sum) * total;
      t += ((lengths[i] / sum) * total * (7200 / total)) * 1000 * (km > total / 2 ? 1.1 : 1);
      return `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><time>${new Date(t).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${150 + Math.round(km)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`;
    });
    return `<gpx><trk><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
  })();

  it("reads time and heart rate from a watch GPX", () => {
    const run = parseRun(runGpx);
    expect(run.length).toBe(points.length);
    expect(run[10].hr).toBeGreaterThan(149);
    expect(() => parseRun(`<trkpt lat="3" lon="101"><ele>1</ele></trkpt><trkpt lat="3.1" lon="101"><ele>1</ele></trkpt>`)).toThrow(/no timed track points/);
  });

  it("lines the run up with the plan", () => {
    const review = reviewRun(plan, parseRun(runGpx));
    expect(review.finishSeconds).toBeCloseTo(7200 * 1.05, -2);
    expect(review.secondHalfSeconds).toBeGreaterThan(review.firstHalfSeconds);
    expect(review.splits).toHaveLength(plan.splits.length);
    const sum = review.splits.reduce((s, k) => s + k.actualSeconds, 0);
    expect(sum).toBeCloseTo(review.finishSeconds, 0);
    expect(review.splits[0].hr).toBeGreaterThan(149);
    expect(review.uphills.length).toBe(plan.hills.filter((h) => h.kind === "uphill").length);
  });
});
