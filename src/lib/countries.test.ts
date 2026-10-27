import { describe, expect, it } from "vitest";
import { COUNTRIES, findCountry, splitLocation } from "./countries";

describe("countries", () => {
  it("names every code and finds countries by code or name", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(COUNTRIES.every((c) => c.name !== c.code)).toBe(true);
    expect(findCountry("my")?.name).toBe("Malaysia");
    expect(findCountry(" singapore ")?.code).toBe("SG");
    expect(findCountry("Atlantis")).toBeUndefined();
  });
  it("splits an old location into city and country", () => {
    expect(splitLocation("Kuala Lumpur, Malaysia")).toEqual({ city: "Kuala Lumpur", country: "MY" });
    expect(splitLocation("George Town, Penang, Malaysia")).toEqual({ city: "George Town, Penang", country: "MY" });
    expect(splitLocation("Putrajaya")).toEqual({ city: "Putrajaya", country: "" });
  });
});
