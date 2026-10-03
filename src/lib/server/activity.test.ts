import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[], fail: false }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (db.fail && text.startsWith("insert")) throw new Error("network");
    db.queries.push({ text, values });
    return text.startsWith("select id, at")
      ? [{ id: 7, at: new Date("2026-10-03T07:00:00Z"), email: "alex@gmail.com", kind: "goal", race_id: "klscm-2026-hm", detail: "1:59:00, start 05:30" }]
      : [];
  },
}));

async function load() {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgres://neon");
  return import("./activity");
}

describe("activity log", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    db.queries = [];
    db.fail = false;
  });

  it("logs by lowercased email, trims long details and never throws", async () => {
    const { logEvent } = await load();
    await logEvent(" Alex@Gmail.com ", "comment", "klscm-2026-hm", "x".repeat(500));
    expect(db.queries.at(-1)?.values).toEqual(["alex@gmail.com", "comment", "klscm-2026-hm", "x".repeat(200)]);
    db.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logEvent("a@gmail.com", "signin")).resolves.toBeUndefined();
  });

  it("lists events for one runner, newest first", async () => {
    const { listEvents } = await load();
    expect(await listEvents({ email: "Alex@gmail.com" })).toEqual([
      { id: "7", at: "2026-10-03T07:00:00.000Z", email: "alex@gmail.com", kind: "goal", raceId: "klscm-2026-hm", detail: "1:59:00, start 05:30" },
    ]);
    const q = db.queries.at(-1)!;
    expect(q.text).toContain("order by at desc");
    expect(q.values).toEqual(["alex@gmail.com", "alex@gmail.com", null, null, 300]);
  });
});
