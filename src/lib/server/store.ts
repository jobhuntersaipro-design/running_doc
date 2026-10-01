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
  bucket: string;
  /** Public base URL for reading files (r2.dev or a custom domain), no trailing slash. */
  publicUrl: string;
}

/** A storage failure with a message that says what to fix. Safe to show to the signed-in admin. */
export class StorageError extends Error {}

let r2Cache: R2Config | null | undefined;
function r2(): R2Config | null {
  if (r2Cache !== undefined) return r2Cache;
  // Values pasted into a dashboard often carry spaces or a trailing newline.
  const env = (name: string) => (process.env[name] ?? "").trim();
  // Account IDs are 32 hex characters. Take them out of whatever was pasted: the bare ID, the
  // S3 API URL (https://<id>.r2.cloudflarestorage.com/<bucket>) or a dashboard link.
  const rawAccount = env("R2_ACCOUNT_ID");
  const accountId = /[0-9a-f]{32}/i.exec(rawAccount)?.[0] ?? rawAccount;
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET");
  let publicUrl = env("R2_PUBLIC_URL").replace(/\/+$/, "");
  if (publicUrl && !/^https?:\/\//.test(publicUrl)) publicUrl = `https://${publicUrl}`;
  // R2_ENDPOINT is optional: for buckets in a jurisdiction, e.g. https://<account>.eu.r2.cloudflarestorage.com
  const endpoint = (env("R2_ENDPOINT") || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  r2Cache =
    accountId && accessKeyId && secretAccessKey && bucket && publicUrl
      ? {
          client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
          bucketUrl: `${endpoint}/${bucket}`,
          bucket,
          publicUrl,
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

/** Calls the R2 S3 API. A missing object (404 NoSuchKey) is returned, not thrown, when allowMissing is set. */
async function r2Fetch(cfg: R2Config, pathAndQuery: string, init: RequestInit = {}, allowMissing = false): Promise<Response> {
  let res: Response;
  try {
    // Sign only, then send the raw bytes: aws4fetch's own fetch streams the body without a
    // Content-Length, and R2 rejects that with 411 MissingContentLength.
    const signed = await cfg.client.sign(`${cfg.bucketUrl}${pathAndQuery}`, init);
    res = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: init.body, cache: "no-store" });
  } catch (e) {
    throw new StorageError(
      `Could not reach R2 at ${new URL(cfg.bucketUrl).host}. Check R2_ACCOUNT_ID (the 32 character account ID). (${(e as Error).message})`,
    );
  }
  if (res.ok) return res;
  const xml = await res.text();
  const code = /<Code>([^<]*)<\/Code>/.exec(xml)?.[1] ?? "";
  const message = /<Message>([^<]*)<\/Message>/.exec(xml)?.[1] ?? "";
  if (res.status === 404 && allowMissing && code !== "NoSuchBucket") return res;
  if (code === "NoSuchBucket") throw new StorageError(`R2 has no bucket named "${cfg.bucket}" in this account. Check R2_BUCKET.`);
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch" || res.status === 401)
    throw new StorageError(`R2 rejected the keys (${code || res.status}). Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.`);
  if (code === "AccessDenied" || res.status === 403)
    throw new StorageError(`The R2 token is not allowed to use bucket "${cfg.bucket}" (${code || res.status}). Give the token Object Read & Write on that bucket.`);
  throw new StorageError(`R2 ${init.method ?? "GET"} failed: ${res.status} ${code} ${message}`.trim());
}

/** Tries a list call so the admin can see whether storage works, and why not. */
export async function checkStorage(): Promise<{ ok: true; mode: "r2" | "local" } | { ok: false; error: string }> {
  if (!storageReady()) return { ok: false, error: new StorageNotReadyError().message };
  try {
    await listFiles("races/");
    return { ok: true, mode: r2() ? "r2" : "local" };
  } catch (e) {
    return { ok: false, error: e instanceof StorageError ? e.message : "File storage failed. Check the R2 settings." };
  }
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
    const res = await r2Fetch(cfg, `/${encodeKey(key)}`, {}, true);
    if (!res.ok) throw new StorageError(`A stored file is missing: ${key}`);
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
        await r2Fetch(cfg, `/${encodeKey(key)}`, { method: "DELETE" }, true);
      }
    }),
  );
}
