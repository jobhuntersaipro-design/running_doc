import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { klscm2026Hm as course } from "../courses/klscm-2026-hm";
import { buildPlan } from "../planner";
import { buildFitWorkout, fitCrc } from "./fit";

const plan = buildPlan({
  name: course.name,
  gpx: readFileSync(course.gpxPath, "utf8"),
  officialKm: course.officialKm,
  goalSeconds: 7140,
  stations: course.stations,
});

describe("buildFitWorkout", () => {
  const bytes = buildFitWorkout(plan, { createdAt: new Date("2026-10-01T00:00:00Z"), name: "Test plan" });
  const view = new DataView(bytes.buffer);

  it("writes a valid header", () => {
    expect(bytes[0]).toBe(14);
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe(".FIT");
    expect(view.getUint32(4, true)).toBe(bytes.length - 16);
    expect(view.getUint16(12, true)).toBe(fitCrc(bytes.subarray(0, 12)));
  });

  it("ends with a CRC over the whole file", () => {
    expect(view.getUint16(bytes.length - 2, true)).toBe(fitCrc(bytes.subarray(0, bytes.length - 2)));
    // A CRC run over data plus its own CRC comes out as zero.
    expect(fitCrc(bytes)).toBe(0);
  });

  it("is reproducible for a fixed creation time", () => {
    const again = buildFitWorkout(plan, { createdAt: new Date("2026-10-01T00:00:00Z"), name: "Test plan" });
    expect(Buffer.from(again).equals(Buffer.from(bytes))).toBe(true);
  });

  it("stores the workout name and one step per split", () => {
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("Test plan");
    expect(text).toContain("Km 1");
    expect(text).toContain(`Km ${plan.splits.length}`);
  });
});

describe("pace blocks", () => {
  it("covers the whole course without gaps", () => {
    const { blocks } = plan;
    expect(blocks[0].startKm).toBe(0);
    expect(blocks.at(-1)!.endKm).toBeCloseTo(course.officialKm, 6);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].startKm).toBe(blocks[i - 1].endKm);
    expect(blocks.length).toBeLessThan(plan.splits.length / 2);
  });
});
