import { describe, expect, it } from "vitest";
import { sameRace } from "./distance";

describe("sameRace", () => {
  const kl = { event: "Standard Chartered KL Marathon 2026", date: "2026-10-04", km: 21.0975 };
  it("matches the same event, day and distance, however the name is written", () => {
    expect(sameRace(kl, { event: "KL marathon", date: "2026-10-04", km: 21.1 })).toBe(true);
    expect(sameRace(kl, { event: "standard-chartered  KL Marathon 2026!", date: "2026-10-04", km: 21 })).toBe(true);
  });
  it("tells apart another distance, day or event", () => {
    expect(sameRace(kl, { ...kl, km: 10 })).toBe(false);
    expect(sameRace(kl, { ...kl, date: "2026-10-05" })).toBe(false);
    expect(sameRace(kl, { ...kl, event: "Penang Bridge Marathon" })).toBe(false);
    expect(sameRace({ ...kl, date: undefined }, { ...kl, date: undefined })).toBe(false);
  });
});
