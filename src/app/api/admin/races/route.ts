import { revalidatePath } from "next/cache";
import { sameRace } from "@/lib/courses/distance";
import { logEvent } from "@/lib/server/activity";
import { apiAuthError } from "@/lib/server/auth";
import { API_ACTOR, apiFailure, parseRaceInput, slugify, uniqueId, writeRace } from "@/lib/server/race-input";
import { overviewRaces, type RaceCard } from "@/lib/server/races";

/**
 * Races API for bots, with a bearer token (RACES_API_TOKEN). Races added here are
 * public admin races, the same record the /admin form saves. Adding races sends no
 * email: POST /api/admin/races/digest emails runners once the batch is done.
 */

const summary = (r: RaceCard) => ({
  id: r.id,
  event: r.event,
  category: r.category,
  date: r.date ?? null,
  officialKm: r.km,
  status: r.preview ? "ready" : "upcoming",
  hasGpx: r.files.some((f) => f.kind === "gpx"),
  hasPdf: r.files.some((f) => f.kind === "pdf"),
  hasCover: Boolean(r.coverUrl),
  builtIn: r.builtIn,
});

/** Public races: built-in, added by the admin, or published by runners. ?date=YYYY-MM-DD and ?q=text narrow the list. */
export async function GET(req: Request) {
  const denied = apiAuthError(req);
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const date = params.get("date");
  const q = params.get("q")?.trim().toLowerCase();
  const races = (await overviewRaces(null))
    .filter((r) => (!date || r.date === date) && (!q || `${r.event} ${r.category}`.toLowerCase().includes(q)))
    .map(summary);
  return Response.json({ races }, { headers: { "cache-control": "no-store" } });
}

/** Adds a public race from multipart fields named like the race form. Without a GPX it is listed as upcoming. */
export async function POST(req: Request) {
  const denied = apiAuthError(req);
  if (denied) return denied;
  const fd = await req.formData().catch(() => null);
  if (!fd) return Response.json({ error: "Send the race as multipart/form-data." }, { status: 400 });
  const parsed = await parseRaceInput(fd, { requireGpx: false });
  if (!("input" in parsed)) return Response.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: parsed.tooLarge ? 413 : 400 });
  const { input } = parsed;
  try {
    // Same check as publishing a runner's race: same event name, day and distance.
    const same = (await overviewRaces(null)).find((r) => sameRace(r, { event: input.event, date: input.date, km: input.officialKm }));
    if (same) return Response.json({ error: "Race already exists", existing: summary(same) }, { status: 409 });
    // The slug is taken by another edition of the race: give this one its year.
    const slug = slugify(`${input.event} ${input.category}`);
    let id = await uniqueId(slug);
    if (id !== (slug || "race")) id = await uniqueId(`${slug}-${input.date.slice(0, 4)}`);
    const saved = await writeRace(input, id, null, { announcedAt: Date.now() });
    if (!("race" in saved)) return Response.json(saved, { status: 400 });
    await logEvent(API_ACTOR, "race_added", id, `${input.event}, ${input.category}`);
    revalidatePath("/");
    revalidatePath(`/races/${id}`);
    revalidatePath("/admin");
    return Response.json(saved, { status: 201 });
  } catch (e) {
    return apiFailure(e);
  }
}
