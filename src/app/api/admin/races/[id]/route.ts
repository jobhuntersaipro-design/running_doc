import { revalidatePath } from "next/cache";
import { getRace } from "@/lib/courses";
import { logEvent } from "@/lib/server/activity";
import { apiAuthError } from "@/lib/server/auth";
import { API_ACTOR, apiFailure, parseRaceInput, writeRace } from "@/lib/server/race-input";
import { getStoredRace } from "@/lib/server/races";

/**
 * Updates a public race added by the admin or the API. Fields left out keep their
 * stored value; files sent replace the stored ones. The id never changes.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/races/[id]">) {
  const denied = apiAuthError(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (getRace(id) || id === "custom") return Response.json({ error: "Built-in races cannot be changed here." }, { status: 403 });
  let existing;
  try {
    existing = await getStoredRace(id);
  } catch (e) {
    return apiFailure(e);
  }
  if (!existing) return Response.json({ error: "No race with this id." }, { status: 404 });
  if (existing.owner) return Response.json({ error: "This race belongs to a runner." }, { status: 403 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return Response.json({ error: "Send the changes as multipart/form-data." }, { status: 400 });
  // Older races keep only "City, Country" in location.
  const where = existing.location.split(",").map((s) => s.trim());
  const keep: Record<string, string> = {
    event: existing.event,
    category: existing.category,
    date: existing.date,
    country: existing.country ?? where.at(-1) ?? "",
    city: existing.city ?? where[0],
    bib: existing.bib ?? "",
    officialUrl: existing.officialUrl,
    startTime: existing.startTime ?? "",
    distance: existing.distance,
    customKm: String(existing.officialKm),
    stations: JSON.stringify(existing.stations),
    stationsApproximate: existing.stationsApproximate ? "on" : "",
  };
  for (const [k, v] of Object.entries(keep)) if (!fd.has(k)) fd.set(k, v);

  const parsed = await parseRaceInput(fd, { requireGpx: false });
  if (!("input" in parsed)) return Response.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: parsed.tooLarge ? 413 : 400 });
  try {
    const { owner, ownerName, publishedBy, publishedAt, announcedAt } = existing;
    const saved = await writeRace(parsed.input, id, existing, { owner, ownerName, publishedBy, publishedAt, announcedAt });
    if (!("race" in saved)) return Response.json(saved, { status: 400 });
    await logEvent(API_ACTOR, "race_edited", id, `${parsed.input.event}, ${parsed.input.category}`);
    revalidatePath("/");
    revalidatePath(`/races/${id}`);
    revalidatePath("/admin");
    return Response.json(saved);
  } catch (e) {
    return apiFailure(e);
  }
}
