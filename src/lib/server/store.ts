import "server-only";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, list, put } from "@vercel/blob";

/**
 * File storage for races added in /admin.
 *
 * With BLOB_READ_WRITE_TOKEN set (a Vercel Blob store connected to the
 * project), files go to Vercel Blob. Without it, they go to the gitignored
 * .data folder and are served by /api/files, which suits local development.
 * Vercel's own file system is read-only, so there Blob is required.
 */

export class StorageNotReadyError extends Error {
  constructor() {
    super("File storage is not set up. Connect a Vercel Blob store to the project, then redeploy.");
  }
}

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const DATA_DIR = path.join(process.cwd(), ".data");

export function storageReady(): boolean {
  return blobEnabled() || !process.env.VERCEL;
}

/** Resolves a store key inside .data, refusing anything that would escape it. */
export function localPath(key: string): string | null {
  const full = path.resolve(DATA_DIR, key);
  return full.startsWith(DATA_DIR + path.sep) ? full : null;
}

/** Saves a file and returns its public URL. */
export async function saveFile(
  key: string,
  body: Buffer | string,
  contentType: string,
  opts: { randomSuffix?: boolean } = {},
): Promise<string> {
  if (!storageReady()) throw new StorageNotReadyError();
  if (blobEnabled()) {
    const blob = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: opts.randomSuffix ?? false,
      allowOverwrite: true,
    });
    return blob.url;
  }
  let finalKey = key;
  if (opts.randomSuffix) {
    const ext = path.extname(key);
    finalKey = `${key.slice(0, key.length - ext.length)}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  }
  const file = localPath(finalKey);
  if (!file) throw new Error("Bad file name");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `/api/files/${finalKey}`;
}

export interface StoredFile {
  key: string;
  url: string;
  uploadedAt: number;
}

/** Every file whose key starts with the prefix. */
export async function listFiles(prefix: string): Promise<StoredFile[]> {
  if (blobEnabled()) {
    const out: StoredFile[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      for (const b of page.blobs) out.push({ key: b.pathname, url: b.url, uploadedAt: new Date(b.uploadedAt).getTime() });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
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
        if (key.startsWith(prefix)) out.push({ key, url: `/api/files/${key}`, uploadedAt: 0 });
      }
    }
  }
  await walk(DATA_DIR);
  return out;
}

/** Reads a stored file as text, from its URL. */
export async function readText(url: string): Promise<string> {
  if (url.startsWith("/api/files/")) {
    const file = localPath(decodeURIComponent(url.slice("/api/files/".length)));
    if (!file) throw new Error("Bad file name");
    return readFile(file, "utf8");
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read ${url}: ${res.status}`);
  return res.text();
}

/** Deletes files by URL. Missing files are ignored. */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (!urls.length) return;
  const blobUrls = urls.filter((u) => !u.startsWith("/api/files/"));
  if (blobUrls.length && blobEnabled()) await del(blobUrls);
  for (const u of urls.filter((x) => x.startsWith("/api/files/"))) {
    const file = localPath(decodeURIComponent(u.slice("/api/files/".length)));
    if (file) await rm(file, { force: true });
  }
}
