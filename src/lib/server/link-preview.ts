import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp as isPrivate, parsePreview } from "@/lib/link-meta";

export interface LinkPreview {
  url: string;
  host: string;
  title?: string;
  description?: string;
  image?: string;
}

/** Only public http(s) hosts: race links can be typed by any signed-in runner. */
async function isPublicUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isPrivate(host);
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivate(a.address));
  } catch {
    return false;
  }
}

/**
 * Title, description and image of a web page, from its Open Graph tags, for the
 * official website card. Cached for a day; null when the page cannot be read.
 */
export async function linkPreview(href: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  try {
    let res: Response | null = null;
    // Follow redirects by hand so every hop is checked.
    for (let hop = 0; hop < 4; hop++) {
      if (!(await isPublicUrl(url))) return null;
      res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 (compatible; RunningDocBot/1.0; +https://www.running-doc.space)", accept: "text/html" },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 86400 },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      url = new URL(next, url);
    }
    if (!res?.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    // ponytail: reads the first 256 KB as text, enough for the <head> of nearly every page.
    const html = (await res.text()).slice(0, 256_000);
    const meta = parsePreview(html, url);
    if (!meta) return null;
    return { url: href, host: new URL(href).hostname.replace(/^www\./, ""), ...meta };
  } catch {
    return null;
  }
}
