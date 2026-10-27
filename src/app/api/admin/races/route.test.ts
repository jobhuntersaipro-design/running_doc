import { mkdtemp, readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const runners = vi.hoisted(() => [
  { email: "alex@gmail.com", name: "Alex Tan" },
  { email: "mei@gmail.com", name: "Mei Ling" },
  { email: "sam@gmail.com", name: "Sam" },
]);
// Opted-out runners are left out by the recipients query itself.
vi.mock("@/lib/server/runners", () => ({ db: async () => null, raceEmailRecipients: async () => runners }));

const TOKEN = "t".repeat(40);
const gpx = await readFile(path.join(process.cwd(), "public/races/klscm-2026-hm/course.gpx"), "utf8");
// Local storage writes to <cwd>/.data, so run in a scratch folder that still sees the built-in courses.
const repo = process.cwd();
process.chdir(await mkdtemp(path.join(tmpdir(), "races-api-")));
await symlink(path.join(repo, "public"), "public");
const { GET, POST } = await import("./route");
const { PATCH } = await import("./[id]/route");
const { POST: DIGEST } = await import("./digest/route");
const resend = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}"));

const fields = {
  event: "Penang Bridge Run",
  category: "Half marathon",
  date: "2027-11-21",
  country: "MY",
  city: "Penang",
  officialUrl: "https://example.com",
  distance: "half",
  stations: JSON.stringify([{ km: 5, kinds: ["water"] }]),
};
function req(method: string, url = "http://x/api/admin/races", body: Record<string, string> = {}, files: Record<string, File> = {}, token = TOKEN) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) fd.set(k, v);
  for (const [k, f] of Object.entries(files)) fd.set(k, f);
  return new Request(url, { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body: method === "GET" ? undefined : fd });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const gpxFile = () => new File([gpx], "course.gpx");

describe("races API", () => {
  beforeAll(() => {
    vi.stubEnv("RACES_API_TOKEN", TOKEN);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Running Doc <hello@running-doc.space>");
    vi.stubGlobal("fetch", resend);
  });

  it("is off without a token, and refuses a missing or wrong one without echoing it", async () => {
    vi.stubEnv("RACES_API_TOKEN", "");
    expect((await POST(req("POST"))).status).toBe(503);
    vi.stubEnv("RACES_API_TOKEN", TOKEN);
    expect((await POST(req("POST", undefined, {}, {}, ""))).status).toBe(401);
    const wrong = await GET(req("GET", undefined, {}, {}, "nope"));
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toBe('{"error":"Unauthorized"}');
  });

  it("adds an upcoming race, refuses the duplicate, then attaches the GPX", async () => {
    const created = await POST(req("POST", undefined, fields));
    expect(created.status).toBe(201);
    const { race } = await created.json();
    expect(race).toMatchObject({ id: "penang-bridge-run-half-marathon", status: "upcoming", location: "Penang, Malaysia" });
    expect([race.gpxUrl, race.owner]).toEqual([undefined, undefined]);

    const files = () => readdir(path.join(".data/races", race.id));
    const before = await files();
    const dup = await POST(req("POST", undefined, fields));
    expect(dup.status).toBe(409);
    const body = await dup.json();
    expect(body.existing.id).toBe(race.id);
    expect(body.existing.updatedAt).toBe(race.updatedAt);
    expect(await files()).toEqual(before);

    const patched = await PATCH(req("PATCH", undefined, { startTime: "05:30" }, { gpx: gpxFile() }), ctx(race.id));
    expect(patched.status).toBe(200);
    const ready = (await patched.json()).race;
    expect(ready).toMatchObject({ id: race.id, status: "ready", startTime: "05:30", event: fields.event, stations: [{ km: 5, kinds: ["water"] }] });
    expect(ready.facts.preview.d).toBeTruthy();
    expect((await files()).filter((f) => f.startsWith("race-"))).toHaveLength(1);

    const list = (await (await GET(req("GET", "http://x/api/admin/races?q=penang"))).json()).races;
    expect(list).toEqual([expect.objectContaining({ id: race.id, status: "ready", hasGpx: true, builtIn: false })]);
  });

  it("gives the next edition its year, and a second category its own id", async () => {
    const next = await POST(req("POST", undefined, { ...fields, date: "2028-11-19" }));
    expect((await next.json()).race.id).toBe("penang-bridge-run-half-marathon-2028");
    const tenK = await POST(req("POST", undefined, { ...fields, category: "10K", distance: "10k" }, { gpx: gpxFile() }));
    expect((await tenK.json()).race).toMatchObject({ id: "penang-bridge-run-10k", status: "ready" });
  });

  it("refuses built-in and unknown ids, bad fields and oversized files", async () => {
    expect((await PATCH(req("PATCH"), ctx("klscm-2026-hm"))).status).toBe(403);
    expect((await PATCH(req("PATCH"), ctx("no-such-race"))).status).toBe(404);
    const bad = await POST(req("POST", undefined, { ...fields, date: "soon" }, { pdf: new File(["hello"], "x.pdf") }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fieldErrors).toEqual({ date: "Choose the race date.", pdf: "This file is not a PDF." });
    const big = await POST(req("POST", undefined, fields, { pdf: new File([new Uint8Array(4.4 * 1024 * 1024)], "x.pdf") }));
    expect(big.status).toBe(413);
  });

  it("sends no email when races are added, then one digest per runner of the three nearest upcoming events", async () => {
    expect(resend).not.toHaveBeenCalled();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:00:00Z") });
    for (const [event, date] of [["Ipoh Heritage Run", "2027-03-07"], ["Melaka River Run", "2027-05-02"], ["Kuching Run", "2029-01-01"]])
      await POST(req("POST", undefined, { ...fields, event, date }));
    expect(resend).not.toHaveBeenCalled();

    const digest = () => DIGEST(new Request("https://www.running-doc.space/api/admin/races/digest", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }));
    const res = await digest();
    expect(await res.json()).toEqual({
      sent: 3,
      runners: 3,
      races: ["ipoh-heritage-run-half-marathon", "melaka-river-run-half-marathon", "penang-bridge-run-half-marathon"],
    });
    const [url, init] = resend.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const emails = JSON.parse(init.body as string);
    expect(emails.map((e: { to: string }) => e.to)).toEqual(runners.map((r) => r.email));
    expect(emails[0].subject).toBe("3 upcoming races: Ipoh Heritage Run + 2 more");
    expect(emails[0].text).toContain("Penang Bridge Run\nSunday 21 November 2027\nPenang, Malaysia\n10K · 21K\nRace plan: https://www.running-doc.space/races/penang-bridge-run-half-marathon");
    // The built-in KL Marathon (3 October 2026) is past, and Kuching is fourth.
    expect(emails[0].html).not.toContain("KL Marathon");
    expect(emails[0].html).not.toContain("Kuching");
    expect(emails[0].html.match(/Open race plan/g)).toHaveLength(3);

    expect((await digest()).status).toBe(409);
    expect(resend).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("refuses to send the digest without a verified sender", async () => {
    const digest = () => DIGEST(new Request("http://x/api/admin/races/digest", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("EMAIL_FROM", "");
    expect((await digest()).status).toBe(503);
    vi.stubEnv("EMAIL_FROM", "Running Doc <onboarding@resend.dev>");
    expect((await digest()).status).toBe(503);
    expect((await DIGEST(new Request("http://x/api/admin/races/digest", { method: "POST" }))).status).toBe(401);
  });
});
