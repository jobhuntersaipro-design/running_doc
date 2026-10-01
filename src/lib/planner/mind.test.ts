import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import { buildPlan } from "./index";

const gpx = readFileSync(course.gpxPath, "utf8");
const plan = buildPlan({ name: course.name, gpx, officialKm: course.officialKm, goalSeconds: 7140, stations: course.stations });

describe("race parts", () => {
  it("cover the whole race in order without gaps", () => {
    const parts = plan.chapters;
    expect(parts[0].startKm).toBe(0);
    expect(parts.at(-1)!.endKm).toBeCloseTo(course.officialKm, 6);
    parts.forEach((p, i) => {
      expect(p.endKm).toBeGreaterThan(p.startKm);
      if (i > 0) expect(p.startKm).toBe(parts[i - 1].endKm);
    });
  });

  it("names the hills on a hilly course and ends with dig deep and finish", () => {
    const titles = plan.chapters.map((p) => p.title);
    expect(titles[0]).toBe("Settle in");
    expect(titles).toContain("The hills");
    expect(titles.slice(-2)).toEqual(["Dig deep", "Finish"]);
  });

  it("skips the hills part on a flat course", () => {
    const flat = `<gpx><trk><trkseg>${Array.from({ length: 101 }, (_, i) => `<trkpt lat="${(i * 0.0009).toFixed(6)}" lon="101"><ele>20</ele></trkpt>`).join("")}</trkseg></trk></gpx>`;
    const p = buildPlan({ name: "flat", gpx: flat, officialKm: 10, goalSeconds: 3300, stations: [] });
    expect(p.chapters.map((c) => c.title)).not.toContain("The hills");
  });
});

describe("runner notes", () => {
  it("gives every hill, gel and the first drink a feeling and a cue", () => {
    for (const e of plan.events.filter((e) => ["uphill", "downhill", "gel", "start", "push"].includes(e.type))) {
      expect(e.cue).toBeTruthy();
      expect(e.feel).toBeTruthy();
    }
    const drinks = plan.events.filter((e) => e.type === "drink");
    expect(drinks[0].feel).toBeTruthy();
    expect(drinks.every((d) => d.cue)).toBe(true);
  });
});
