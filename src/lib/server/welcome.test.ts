import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listFiles, saveFile, userKey } from "./store";
import { welcomeOnce } from "./welcome";

vi.mock("server-only", () => ({}));
vi.mock("./store", async (original) => ({ ...(await original<typeof import("./store")>()), listFiles: vi.fn(), saveFile: vi.fn(), storageReady: () => true }));

const site = "https://www.running-doc.space";
const sent = (fetch: ReturnType<typeof vi.fn>) => JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

describe("welcome email", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.mocked(listFiles).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("greets a new runner by first name, with their name escaped, and records that it was sent", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await welcomeOnce("runner@gmail.com", "<b>Al</b> Smith", site);
    const body = sent(fetch);
    expect(body).toMatchObject({ to: "runner@gmail.com", reply_to: "jobhunters.ai.pro@gmail.com", subject: "Welcome, <b>Al</b>: 3 steps to your race plan" });
    expect(body.html).toContain("Welcome, &#60;b&#62;Al&#60;/b&#62;. Let's get you race-ready.");
    expect(body.html).not.toContain("<b>Al");
    expect(body.html).toContain(`href="${site}/my"`);
    expect(body.text).toContain(`Add your first race: ${site}/my`);
    expect(saveFile).toHaveBeenCalledWith(userKey("runner@gmail.com", "welcomed.txt"), expect.any(String), "text/plain");
  });

  it("falls back to a plain greeting when Google gives no name", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await welcomeOnce("runner@gmail.com", "runner@gmail.com", site);
    expect(sent(fetch).subject).toBe("Welcome: 3 steps to your race plan");
    expect(sent(fetch).html).toContain("Welcome. Let's get you race-ready.");
  });

  it("skips runners who already have files, and leaves no marker when sending fails", async () => {
    const fetch = vi.fn(async () => new Response("domain not verified", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listFiles).mockResolvedValueOnce([{ key: "users/x/welcomed.txt", url: "/api/files/users/x/welcomed.txt" }]);
    await welcomeOnce("runner@gmail.com", "Alex", site);
    expect(fetch).not.toHaveBeenCalled();
    await welcomeOnce("runner@gmail.com", "Alex", site);
    expect(fetch).toHaveBeenCalledOnce();
    expect(saveFile).not.toHaveBeenCalled();
  });
});
