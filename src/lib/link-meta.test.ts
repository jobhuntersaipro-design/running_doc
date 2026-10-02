import { describe, expect, it } from "vitest";
import { isPrivateIp, parsePreview } from "./link-meta";

describe("link previews", () => {
  it("reads Open Graph tags in either attribute order and resolves the image", () => {
    const html = `<head><title>Fallback</title>
      <meta content="KL Marathon 2026" property="og:title">
      <meta property='og:description' content='Run &amp; explore Kuala Lumpur'>
      <meta property="og:image" content="/img/cover.jpg"></head>`;
    expect(parsePreview(html, new URL("https://www.kl-marathon.com/"))).toEqual({
      title: "KL Marathon 2026",
      description: "Run & explore Kuala Lumpur",
      image: "https://www.kl-marathon.com/img/cover.jpg",
    });
  });

  it("falls back to the title tag and drops non-http images", () => {
    expect(parsePreview(`<title>Race</title><meta property="og:image" content="javascript:alert(1)">`, new URL("https://x.com"))).toEqual({
      title: "Race",
      description: undefined,
      image: undefined,
    });
    expect(parsePreview("<p>nothing</p>", new URL("https://x.com"))).toBeNull();
  });

  it("refuses private and loopback addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"])
      expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["104.20.31.92", "8.8.8.8", "2606:4700:10::ac42:a0d4"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});
