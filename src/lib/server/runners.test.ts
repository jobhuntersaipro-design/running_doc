import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[], failNext: 0 }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (db.failNext-- > 0) throw new Error("network");
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    db.queries.push({ text, values });
    return text.startsWith("select count") ? [{ n: 2 }] : [];
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
  });

  it("does nothing without a database", async () => {
    const { recordSignIn, countRunners } = await load("");
    await recordSignIn("a@gmail.com", "A");
    expect(await countRunners()).toBeNull();
    expect(db.queries).toEqual([]);
  });

  it("creates the table once, records sign-ins by lowercased email and counts them", async () => {
    const { recordSignIn, countRunners } = await load("postgres://neon");
    await recordSignIn(" Alex@Gmail.com ", "Alex Tan");
    await recordSignIn("alex@gmail.com", "Alex Tan");
    expect(await countRunners()).toBe(2);
    expect(db.queries.filter((q) => q.text.startsWith("create table")).length).toBe(1);
    expect(db.queries[1]).toMatchObject({ values: ["alex@gmail.com", "Alex Tan"] });
    expect(db.queries[1].text).toContain("on conflict (email) do update");
  });

  it("retries creating the table after a failure", async () => {
    const { recordSignIn } = await load("postgres://neon");
    db.failNext = 1;
    await expect(recordSignIn("a@gmail.com", "A")).rejects.toThrow("network");
    await recordSignIn("a@gmail.com", "A");
    expect(db.queries.map((q) => q.text.split(" ")[0])).toEqual(["create", "insert"]);
  });
});
