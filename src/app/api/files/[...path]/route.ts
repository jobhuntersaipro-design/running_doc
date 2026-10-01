import { readFile } from "node:fs/promises";
import path from "node:path";
import { localPath } from "@/lib/server/store";

const TYPES: Record<string, string> = {
  ".gpx": "application/gpx+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Serves files saved to .data when no Blob store is connected (local development). */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: parts } = await ctx.params;
  const file = localPath(parts.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-cache",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
