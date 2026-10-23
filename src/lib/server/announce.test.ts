import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announceRace, raceEmail, unsubscribeToken, validUnsubscribe, type AnnouncedRace } from "./announce";
import { raceEmailRecipients } from "./runners";

vi.mock("server-only", () => ({}));
vi.mock("./runners", () => ({ raceEmailRecipients: vi.fn() }));
vi.mock("./activity", () => ({ logEvent: vi.fn() }));

const site = "https://www.running-doc.space";
const race: AnnouncedRace = {
  id: "penang-bridge-run-2026-half",
  event: "Penang <Bridge> Run 2026",
  category: "Half marathon",
  officialKm: 21.0975,
  dateLabel: "Sunday 15 November 2026",
  startTime: "05:30",
  location: "George Town, Malaysia",
  officialUrl: "https://example.com/?a=1&b=2",
  publishedBy: "Mei Ling",
};

describe("new race email", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "secret"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("says what, when and where, links to the race and carries a signed unsubscribe link", () => {
    const mail = raceEmail(race, { email: "Alex@Gmail.com", name: "Alex Tan" }, site);
    expect(mail.subject).toBe("New race: Penang <Bridge> Run 2026, Half marathon");
    expect(mail.html).toContain("Penang &#60;Bridge&#62; Run 2026");
    expect(mail.html).not.toContain("<Bridge>");
    expect(mail.text).toContain("Hi Alex, a new race is up.");
    expect(mail.text).toContain("What: Half marathon, 21.1 km\nWhen: Sunday 15 November 2026, 5:30 am start\nWhere: George Town, Malaysia");
    expect(mail.text).toContain(`Open the race plan: ${site}/races/penang-bridge-run-2026-half`);
    const token = unsubscribeToken("alex@gmail.com");
    expect(mail.text).toContain(`${site}/unsubscribe?e=alex%40gmail.com&t=${token}`);
    expect(mail.headers).toEqual({ "List-Unsubscribe": `<${site}/api/unsubscribe?e=alex%40gmail.com&t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("accepts an unsubscribe token only for its own email", () => {
    const token = unsubscribeToken("alex@gmail.com");
    expect(validUnsubscribe(" ALEX@gmail.com", token)).toBe(true);
    expect(validUnsubscribe("mei@gmail.com", token)).toBe(false);
    expect(validUnsubscribe("alex@gmail.com", "nope")).toBe(false);
  });

  it("emails everyone left after the exceptions, 100 to a batch", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    vi.mocked(raceEmailRecipients).mockResolvedValue(Array.from({ length: 150 }, (_, i) => ({ email: `r${i}@gmail.com`, name: `R ${i}` })));
    expect(await announceRace(race, site, "mei@gmail.com", ["mei@gmail.com"])).toBe(150);
    expect(raceEmailRecipients).toHaveBeenCalledWith(["mei@gmail.com"]);
    const batches = fetch.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(batches.map((b) => b.length)).toEqual([100, 50]);
    expect(batches[1][49].to).toBe("r149@gmail.com");
  });
});
