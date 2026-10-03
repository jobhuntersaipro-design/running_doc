"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRace } from "@/lib/courses";
import { findCountry } from "@/lib/countries";
import { parseGpx, type Station } from "@/lib/planner";
import { endSession, getUser, isAdmin, startSession, verifyCredentials, type SessionUser } from "@/lib/server/auth";
import {
  cardFacts,
  deleteRaceFiles,
  getCoverOverride,
  getStoredRace,
  listRaces,
  publishedTwin,
  saveRecord,
  type StoredRace,
} from "@/lib/server/races";
import { deleteFiles, readText, saveFile, StorageError, StorageNotReadyError } from "@/lib/server/store";
import { DISTANCES, LIMITS, STATION_KINDS, formatMb, type DistanceValue, type FormState } from "./shared";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function file(fd: FormData, key: string): File | null {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/signin");
  return user;
}

const owns = (user: SessionUser, race: StoredRace) => user.admin || race.owner?.toLowerCase() === user.email.toLowerCase();
const homeOf = (user: SessionUser) => (user.admin ? "/admin" : "/my");
/** ponytail: flat cap per runner, add quotas by storage size if R2 costs matter. */
const MAX_RACES_PER_RUNNER = 20;

function storageError(e: unknown): FormState {
  if (e instanceof StorageNotReadyError || e instanceof StorageError) return { error: e.message };
  console.error(e);
  return { error: "The race could not be saved. Try again in a moment." };
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const ok = await verifyCredentials(text(fd, "email"), String(fd.get("password") ?? ""));
  if (!ok) {
    // Slows down password guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That email and password do not match." };
  }
  await startSession({ email: text(fd, "email"), name: "Admin" });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};

/** Reads and checks a cover image. Returns the bytes and type, or an error message. */
async function readCover(f: File): Promise<{ body: Buffer; type: string; ext: string } | string> {
  if (f.size > LIMITS.cover) return `Use a cover image under ${formatMb(LIMITS.cover)}.`;
  const body = Buffer.from(await f.arrayBuffer());
  const entry = Object.entries(IMAGE_TYPES).find(([, t]) => t.magic(body));
  if (!entry) return "Use a JPG, PNG or WebP image for the cover.";
  return { body, type: entry[0], ext: entry[1].ext };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

async function uniqueId(base: string): Promise<string> {
  const root = base || "race";
  for (let n = 1; n < 100; n++) {
    const id = n === 1 ? root : `${root}-${n}`;
    if (id !== "custom" && !getRace(id) && !(await getStoredRace(id))) return id;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

function dateLabelOf(iso: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .replace(",", "");
}

function parseStations(raw: string, km: number): Station[] | null {
  try {
    const list = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(list)) return null;
    const allowed = new Set<string>(STATION_KINDS.map((k) => k.value));
    return list
      .map((s) => ({
        km: Math.round(Number((s as Station).km) * 100) / 100,
        kinds: Array.isArray((s as Station).kinds) ? (s as Station).kinds.filter((k) => allowed.has(k)) : [],
      }))
      .filter((s) => Number.isFinite(s.km) && s.km > 0 && s.km < km && s.kinds.length)
      .sort((a, b) => a.km - b.km)
      .slice(0, 60) as Station[];
  } catch {
    return null;
  }
}

/** Creates a race, or updates one when the form carries an id. */
export async function saveRace(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const editId = text(fd, "id");
  let existing: StoredRace | null = null;
  try {
    existing = editId ? await getStoredRace(editId) : null;
    if (!editId && !user.admin && (await listRaces()).filter((r) => r.owner?.toLowerCase() === user.email.toLowerCase()).length >= MAX_RACES_PER_RUNNER)
      return { error: `You can add up to ${MAX_RACES_PER_RUNNER} races. Delete one to add another.` };
  } catch (e) {
    return storageError(e);
  }
  if (editId && (!existing || !owns(user, existing))) return { error: "This race no longer exists." };

  const fieldErrors: Record<string, string> = {};
  const event = text(fd, "event");
  const category = text(fd, "category");
  const date = text(fd, "date");
  const country = findCountry(text(fd, "country"));
  const city = text(fd, "city");
  const bib = text(fd, "bib");
  const officialUrl = text(fd, "officialUrl");
  const startTime = text(fd, "startTime");
  const distance = text(fd, "distance") as DistanceValue;
  const preset = DISTANCES.find((d) => d.value === distance);

  if (event.length < 3 || event.length > 120) fieldErrors.event = "Enter the event name, 3 to 120 characters.";
  if (category.length < 2 || category.length > 80) fieldErrors.category = "Enter the race category, for example Half marathon.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fieldErrors.date = "Choose the race date.";
  if (!country) fieldErrors.country = "Choose the country from the list.";
  if (city.length < 2 || city.length > 80) fieldErrors.city = "Enter the city, for example Kuala Lumpur.";
  if (bib && !/^[\p{L}\p{N} -]{1,12}$/u.test(bib)) fieldErrors.bib = "Use up to 12 letters and numbers.";
  try {
    const u = new URL(officialUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    fieldErrors.officialUrl = "Enter the full web address, starting with https://";
  }
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) fieldErrors.startTime = "Enter the start time as HH:mm.";
  let officialKm = 0;
  if (!preset) fieldErrors.distance = "Choose the race distance.";
  else if (preset.value === "custom") {
    officialKm = Number(text(fd, "customKm"));
    if (!Number.isFinite(officialKm) || officialKm < 1 || officialKm > 250) fieldErrors.customKm = "Enter a distance between 1 and 250 km.";
  } else officialKm = preset.km;

  const stations = parseStations(text(fd, "stations"), officialKm || 1000);
  if (!stations) fieldErrors.stations = "The aid stations could not be read. Check them and try again.";

  const gpxFile = file(fd, "gpx");
  const pdfFile = file(fd, "pdf");
  const coverFile = file(fd, "cover");
  const total = (gpxFile?.size ?? 0) + (pdfFile?.size ?? 0) + (coverFile?.size ?? 0);
  if (total > LIMITS.total) return { error: `The files add up to ${formatMb(total)}. Keep them under ${formatMb(LIMITS.total)} in total.` };

  let gpx: string | null = null;
  if (gpxFile) {
    if (gpxFile.size > LIMITS.gpx) fieldErrors.gpx = `Use a GPX under ${formatMb(LIMITS.gpx)}.`;
    else {
      gpx = await gpxFile.text();
      try {
        parseGpx(gpx);
      } catch (e) {
        fieldErrors.gpx = `This GPX could not be used: ${(e as Error).message.toLowerCase()}.`;
      }
    }
  } else if (!existing) fieldErrors.gpx = "Add the course GPX.";

  let pdf: Buffer | null = null;
  if (pdfFile) {
    if (pdfFile.size > LIMITS.pdf) fieldErrors.pdf = `Use a PDF under ${formatMb(LIMITS.pdf)}.`;
    else {
      pdf = Buffer.from(await pdfFile.arrayBuffer());
      if (pdf.subarray(0, 5).toString() !== "%PDF-") fieldErrors.pdf = "This file is not a PDF.";
    }
  }

  let cover: Awaited<ReturnType<typeof readCover>> | null = null;
  if (coverFile) {
    cover = await readCover(coverFile);
    if (typeof cover === "string") fieldErrors.cover = cover;
  }

  if (Object.keys(fieldErrors).length) return { error: "Some details need another look.", fieldErrors };

  try {
    const id = existing?.id ?? (await uniqueId(slugify(`${event} ${category}`)));
    const courseGpx = gpx ?? (await readText(existing!.gpxUrl));
    let facts;
    try {
      facts = cardFacts(event, courseGpx, officialKm, stations!);
    } catch (e) {
      return { error: "Some details need another look.", fieldErrors: { gpx: `This GPX could not be used: ${(e as Error).message}.` } };
    }

    const replaced: string[] = [];
    let gpxUrl = existing?.gpxUrl ?? "";
    if (gpx) {
      if (existing) replaced.push(existing.gpxUrl);
      gpxUrl = await saveFile(`races/${id}/course.gpx`, gpx, "application/gpx+xml", { randomSuffix: true });
    }
    let pdfUrl = existing?.pdfUrl;
    if (pdf) {
      if (pdfUrl) replaced.push(pdfUrl);
      pdfUrl = await saveFile(`races/${id}/route-map.pdf`, pdf, "application/pdf", { randomSuffix: true });
    } else if (text(fd, "removePdf") === "on" && pdfUrl) {
      replaced.push(pdfUrl);
      pdfUrl = undefined;
    }
    let coverUrl = existing?.coverUrl;
    if (cover && typeof cover !== "string") {
      if (coverUrl) replaced.push(coverUrl);
      coverUrl = await saveFile(`races/${id}/cover.${cover.ext}`, cover.body, cover.type, { randomSuffix: true });
    } else if (text(fd, "removeCover") === "on" && coverUrl) {
      replaced.push(coverUrl);
      coverUrl = undefined;
    }

    const record: StoredRace = {
      kind: "stored",
      id,
      event,
      category,
      date,
      dateLabel: dateLabelOf(date),
      location: `${city}, ${country!.name}`,
      country: country!.code,
      city,
      bib: bib || undefined,
      officialUrl,
      distance,
      officialKm,
      startTime: startTime || undefined,
      stations: stations!,
      stationsApproximate: text(fd, "stationsApproximate") === "on",
      gpxUrl,
      pdfUrl,
      coverUrl,
      facts,
      owner: existing ? existing.owner : user.admin ? undefined : user.email,
      publishedBy: existing?.publishedBy,
      publishedAt: existing?.publishedAt,
      updatedAt: Date.now(),
    };
    await saveRecord(record);
    await deleteFiles(replaced);
    revalidatePath("/");
    revalidatePath(`/races/${id}`);
    revalidatePath(homeOf(user));
  } catch (e) {
    return storageError(e);
  }
  redirect(`${homeOf(user)}?saved=1`);
}

/** Sets or removes the cover of a built-in race. */
export async function saveCover(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = text(fd, "id");
  if (!getRace(id)) return { error: "This race no longer exists." };
  const coverFile = file(fd, "cover");
  const remove = text(fd, "removeCover") === "on";
  if (!coverFile && !remove) return { error: "Choose a cover image first.", fieldErrors: { cover: "Choose a cover image." } };
  try {
    const existing = await getCoverOverride(id);
    let coverUrl: string | undefined;
    if (coverFile) {
      const cover = await readCover(coverFile);
      if (typeof cover === "string") return { error: cover, fieldErrors: { cover } };
      coverUrl = await saveFile(`races/${id}/cover.${cover.ext}`, cover.body, cover.type, { randomSuffix: true });
    }
    await saveRecord({ kind: "cover", id, coverUrl, updatedAt: Date.now() });
    if (existing?.coverUrl) await deleteFiles([existing.coverUrl]);
    revalidatePath("/");
    revalidatePath("/admin");
  } catch (e) {
    return storageError(e);
  }
  redirect("/admin?saved=1");
}

/**
 * Makes a runner's race public, credited to them. A race that is already public
 * (same event, day and distance) is not published twice: the runner is sent to it instead.
 */
export async function publishRace(id: string): Promise<FormState> {
  const user = await requireUser();
  let twin;
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race)) return { error: "This race no longer exists." };
    if (!race.owner || race.publishedAt !== undefined) return { error: "This race is already public." };
    twin = await publishedTwin(race);
    if (!twin) await saveRecord({ ...race, publishedBy: user.name, publishedAt: Date.now(), updatedAt: Date.now() });
  } catch (e) {
    return storageError(e);
  }
  if (twin) redirect(`/races/${twin.id}?duplicate=1`);
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}

/** Makes a published race private to its runner again. */
export async function unpublishRace(id: string): Promise<FormState> {
  const user = await requireUser();
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race) || race.publishedAt === undefined) return { error: "This race is not published." };
    await saveRecord({ ...race, publishedBy: undefined, publishedAt: undefined, updatedAt: Date.now() });
  } catch (e) {
    return storageError(e);
  }
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}

/** Deletes a race added in /admin, with its files. Built-in races live in the code and cannot be deleted here. */
export async function deleteRace(id: string): Promise<FormState> {
  const user = await requireUser();
  if (getRace(id)) return { error: "Built-in races are part of the code and cannot be deleted here." };
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race)) return { error: "This race no longer exists." };
    await deleteRaceFiles(id);
  } catch (e) {
    return storageError(e);
  }
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}
