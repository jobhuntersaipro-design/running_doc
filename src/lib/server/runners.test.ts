import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[], failNext: 0, profile: null as unknown, goals: {} as unknown }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (db.failNext-- > 0) throw new Error("network");
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    db.queries.push({ text, values });
    if (text.startsWith("select profile")) return [{ profile: db.profile }];
    if (text.startsWith("select goals")) return [{ goals: db.goals }];
    return text.startsWith("select") ? [{ email: "alex@gmail.com", name: "Alex Tan", signed_up_at: new Date("2026-10-02T08:05:00Z"), last_sign_in_at: new Date("2026-10-03T07:00:00Z") }] : [];
  },
}));

// runners.ts reads DATABASE_URL when it loads, so each test loads a fresh copy.
async function load(url: string) {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", url);
  return import("./runners");
}

describe("runners", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    db.queries = [];
    db.failNext = 0;
    db.profile = null;
    db.goals = {};
  });

  it("does nothing without a database", async () => {
    const { recordSignIn, listRunners } = await load("");
    await recordSignIn("a@gmail.com", "A");
    expect(await listRunners()).toBeNull();
    expect(db.queries).toEqual([]);
  });

  it("creates the table once, records sign-ins by lowercased email and lists runners newest first", async () => {
    const { recordSignIn, listRunners } = await load("postgres://neon");
    await recordSignIn(" Alex@Gmail.com ", "Alex Tan");
    await recordSignIn("alex@gmail.com", "Alex Tan");
    expect(await listRunners()).toEqual([
      { email: "alex@gmail.com", name: "Alex Tan", signedUpAt: "2026-10-02T08:05:00.000Z", lastSignInAt: "2026-10-03T07:00:00.000Z", profile: null, goals: {} },
    ]);
    expect(db.queries.at(-1)?.text).toContain("order by signed_up_at desc");
    expect(db.queries.filter((q) => q.text.startsWith("create table if not exists runners")).length).toBe(1);
    const insert = db.queries.find((q) => q.text.startsWith("insert"));
    expect(insert).toMatchObject({ values: ["alex@gmail.com", "Alex Tan"] });
    expect(insert?.text).toContain("on conflict (email) do update");
  });

  it("retries creating the table after a failure", async () => {
    const { recordSignIn } = await load("postgres://neon");
    db.failNext = 1;
    await expect(recordSignIn("a@gmail.com", "A")).rejects.toThrow("network");
    await recordSignIn("a@gmail.com", "A");
    expect(db.queries.map((q) => q.text.split(" ")[0])).toEqual(["create", "alter", "alter", "create", "create", "alter", "create", "create", "create", "insert"]);
  });

  it("saves a profile as JSON and only returns a valid one", async () => {
    const { saveProfile, getProfile } = await load("postgres://neon");
    const profile = { age: 35, sex: "female" as const, heightCm: null, weightKg: 58, vo2max: 48 };
    expect(await saveProfile("Alex@Gmail.com", "Alex", profile)).toBe(true);
    expect(db.queries.at(-1)?.values).toEqual(["alex@gmail.com", "Alex", JSON.stringify(profile)]);
    db.profile = profile;
    expect(await getProfile("alex@gmail.com")).toEqual(profile);
    db.profile = { age: "old" };
    expect(await getProfile("alex@gmail.com")).toBeNull();
  });

  it("merges a saved goal into the runner's goals and drops invalid ones when reading", async () => {
    const { saveGoal, getGoals } = await load("postgres://neon");
    const goal = { goalSeconds: 7140, startTime: "05:00", savedAt: "2026-10-02T08:00:00.000Z" };
    expect(await saveGoal("Alex@Gmail.com", "Alex", "klscm-2026-hm", goal)).toBe(true);
    const insert = db.queries.at(-1)!;
    expect(insert.values).toEqual(["alex@gmail.com", "Alex", "klscm-2026-hm", JSON.stringify(goal)]);
    expect(insert.text).toContain("goals = runners.goals || excluded.goals");
    db.goals = { "klscm-2026-hm": goal, broken: { goalSeconds: "fast" } };
    expect(await getGoals("alex@gmail.com")).toEqual({ "klscm-2026-hm": goal });
  });
});
