import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSuggestion } from "./actions";

const form = (fields: Record<string, string>, images: File[] = []) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const f of images) fd.append("images", f);
  return fd;
};
const text = "The pace band prints km 18 twice on my iPhone.";

describe("suggestion box", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("emails the suggestion with its images attached and the runner as reply-to", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const shot = new File(["png bytes"], "shot.png", { type: "image/png" });
    expect(await sendSuggestion({}, form({ type: "Bug", text, email: "runner@example.com" }, [shot]))).toEqual({ sent: true });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ to: "jobhunters.ai.pro@gmail.com", reply_to: "runner@example.com", subject: `Running Doc Bug: ${text}` });
    expect(body.attachments).toEqual([{ filename: "shot.png", content: Buffer.from("png bytes").toString("base64") }]);
  });

  it("refuses short text, bad emails, non-images and too many images before sending", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const img = () => new File(["x"], "a.png", { type: "image/png" });
    expect((await sendSuggestion({}, form({ text: "too short" }))).error).toBeTruthy();
    expect((await sendSuggestion({}, form({ text, email: "not an email" }))).error).toBeTruthy();
    expect((await sendSuggestion({}, form({ text }, [new File(["x"], "a.exe", { type: "application/x-msdownload" })]))).error).toBeTruthy();
    expect((await sendSuggestion({}, form({ text }, [img(), img(), img(), img()]))).error).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks runners to email directly when sending is not set up or fails", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await sendSuggestion({}, form({ text }))).error).toContain("jobhunters.ai.pro@gmail.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", async () => new Response("bad key", { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendSuggestion({}, form({ text }))).error).toContain("could not be sent");
  });
});
