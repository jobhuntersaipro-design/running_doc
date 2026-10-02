import { describe, expect, it } from "vitest";
import { finishDensity, shareSlowerThan } from "./benchmarks";

describe("finish-time distribution", () => {
  it("puts the average a little past the middle, as skewed race results do", () => {
    const s = shareSlowerThan(7200, 7200);
    expect(s).toBeGreaterThan(0.4);
    expect(s).toBeLessThan(0.5);
  });

  it("gets faster goals beating more runners, and the density integrates to about 1", () => {
    expect(shareSlowerThan(6000, 7200)).toBeGreaterThan(shareSlowerThan(7000, 7200));
    expect(shareSlowerThan(3000, 7200)).toBeCloseTo(1, 3);
    let area = 0;
    for (let t = 1000; t < 20000; t += 10) area += finishDensity(t, 7200) * 10;
    expect(area).toBeCloseTo(1, 2);
  });
});
