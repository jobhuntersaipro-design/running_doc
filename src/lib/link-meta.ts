/** Pure helpers for link previews, kept free of server imports so they can be tested. */

/** Loopback, private, link-local and similar ranges the server must never be pointed at. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** The content of <meta property|name="key" content="..."> in either attribute order. */
function meta(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
}

/** Title, description and absolute image URL from a page's Open Graph tags, or null if it has none. */
export function parsePreview(html: string, base: URL): { title?: string; description?: string; image?: string } | null {
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const title = meta(html, "og:title") ?? meta(html, "twitter:title") ?? (titleTag ? decode(titleTag) : undefined);
  const description = meta(html, "og:description") ?? meta(html, "twitter:description") ?? meta(html, "description");
  const rawImage = meta(html, "og:image") ?? meta(html, "og:image:url") ?? meta(html, "twitter:image");
  let image: string | undefined;
  try {
    const u = rawImage ? new URL(rawImage, base) : null;
    image = u && (u.protocol === "https:" || u.protocol === "http:") ? u.href : undefined;
  } catch {}
  return title || description || image ? { title, description, image } : null;
}
