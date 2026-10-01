import "server-only";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * File storage for races added in /admin: race details (JSON), course GPX,
 * route map PDF and cover images.
 *
 * With the R2_* variables set, files go to a Cloudflare R2 bucket through its
 * S3 API and are served from the bucket's public URL. Without them, they go to
 * the gitignored .data folder and are served by /api/files, which suits local
 * development. Vercel's own file system is read-only, so there R2 is required.
 */

export class StorageNotReadyError extends Error {
  constructor() {
    super("File storage is not set up. Add the R2 settings to the project's environment variables, then redeploy.");
  }
}

interface R2Config {
  client: AwsClient;
  /** S3 endpoint for the bucket, no trailing slash. */
  bucketUrl: string;
  /** Public base URL for reading files (r2.dev or a custom domain), no trailing slash. */
  publicUrl: string;
}

let r2Cache: R2Config | null | undefined;
function r2(): R2Config | null {
  if (r2Cache !== undefined) return r2Cache;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL, R2_ENDPOINT } = process.env;
  // R2_ENDPOINT is optional: for buckets in a jurisdiction, e.g. https://<account>.eu.r2.cloudflarestorage.com
  const endpoint = (R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  r2Cache =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL
      ? {
          client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
          bucketUrl: `${endpoint}/${R2_BUCKET}`,
          publicUrl: R2_PUBLIC_URL.replace(/\/+$/, ""),
        }
      : null;
  return r2Cache;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_PREFIX = "/api/files/";

export function storageReady(): boolean {
  return Boolean(r2()) || !process.env.VERCEL;
}

/** Resolves a store key inside .data, refusing anything that would escape it. */
export function localPath(key: string): string | null {
  const full = path.resolve(DATA_DIR, key);
  return full.startsWith(DATA_DIR + path.sep) ? full : null;
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

/** The store key behind a file URL, or null if the URL is not ours. */
function keyOf(url: string): string | null {
  if (url.startsWith(LOCAL_PREFIX)) return decodeURIComponent(url.slice(LOCAL_PREFIX.length));
  const cfg = r2();
  if (cfg && url.startsWith(cfg.publicUrl + "/")) return decodeURIComponent(url.slice(cfg.publicUrl.length + 1));
  return null;
}

async function r2Fetch(cfg: R2Config, pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
  const res = await cfg.client.fetch(`${cfg.bucketUrl}${pathAndQuery}`, { ...init, cache: "no-store" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 ${init.method ?? "GET"} ${pathAndQuery} failed: ${res.status} ${await res.text()}`);
  return res;
}

/**
 * Saves a file and returns its public URL. With randomSuffix, each save gets
 * a new name, so a cached old copy is never served in place of the new one.
 */
export async function saveFile(
  key: string,
  body: Buffer | string,
  contentType: string,
  opts: { randomSuffix?: boolean } = {},
): Promise<string> {
  if (!storageReady()) throw new StorageNotReadyError();
  let finalKey = key;
  if (opts.randomSuffix) {
    const ext = path.extname(key);
    finalKey = `${key.slice(0, key.length - ext.length)}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  }
  const cfg = r2();
  if (cfg) {
    await r2Fetch(cfg, `/${encodeKey(finalKey)}`, {
      method: "PUT",
      body: typeof body === "string" ? body : new Uint8Array(body),
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
    return `${cfg.publicUrl}/${encodeKey(finalKey)}`;
  }
  const file = localPath(finalKey);
  if (!file) throw new Error("Bad file name");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `${LOCAL_PREFIX}${finalKey}`;
}

export interface StoredFile {
  key: string;
  url: string;
}

function xmlValues(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  return out;
}

/** Every file whose key starts with the prefix. */
export async function listFiles(prefix: string): Promise<StoredFile[]> {
  const cfg = r2();
  if (cfg) {
    const out: StoredFile[] = [];
    let token: string | undefined;
    do {
      const q = new URLSearchParams({ "list-type": "2", prefix });
      if (token) q.set("continuation-token", token);
      const xml = await (await r2Fetch(cfg, `?${q}`)).text();
      for (const key of xmlValues(xml, "Key")) out.push({ key, url: `${cfg.publicUrl}/${encodeKey(key)}` });
      token = xmlValues(xml, "IsTruncated")[0] === "true" ? xmlValues(xml, "NextContinuationToken")[0] : undefined;
    } while (token);
    return out;
  }
  if (process.env.VERCEL) return [];
  const out: StoredFile[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const key = path.relative(DATA_DIR, full).split(path.sep).join("/");
        if (key.startsWith(prefix)) out.push({ key, url: `${LOCAL_PREFIX}${key}` });
      }
    }
  }
  await walk(DATA_DIR);
  return out;
}

/** Reads a stored file as text, from its URL. R2 files are read through the API, not the public cache. */
export async function readText(url: string): Promise<string> {
  const key = keyOf(url);
  if (key === null) throw new Error("Not a stored file");
  const cfg = r2();
  if (cfg && !url.startsWith(LOCAL_PREFIX)) {
    const res = await r2Fetch(cfg, `/${encodeKey(key)}`);
    if (!res.ok) throw new Error(`Missing file ${key}`);
    return res.text();
  }
  const file = localPath(key);
  if (!file) throw new Error("Bad file name");
  return readFile(file, "utf8");
}

/** Deletes files by URL. Missing files are ignored. */
export async function deleteFiles(urls: string[]): Promise<void> {
  const cfg = r2();
  await Promise.all(
    urls.map(async (url) => {
      const key = keyOf(url);
      if (key === null) return;
      if (url.startsWith(LOCAL_PREFIX)) {
        const file = localPath(key);
        if (file) await rm(file, { force: true });
      } else if (cfg) {
        await r2Fetch(cfg, `/${encodeKey(key)}`, { method: "DELETE" });
      }
    }),
  );
}
