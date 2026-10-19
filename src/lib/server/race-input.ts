import "server-only";
import { getRace } from "@/lib/courses";
import { findCountry } from "@/lib/countries";
import { parseGpx, type Station } from "@/lib/planner";
import { DISTANCES, LIMITS, STATION_KINDS, formatMb, type DistanceValue, type FormState } from "@/app/admin/shared";
import { cardFacts, getStoredRace, saveRecord, type StoredRace } from "./races";
import { deleteFiles, readText, saveFile, StorageError, StorageNotReadyError } from "./store";

/**
 * Checks and saves a race from the race form fields. Shared by the /admin and /my
 * form action and the races API, so both write the same record.
 */

export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export function file(fd: FormData, key: string): File | null {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};

/** Reads and checks a cover image. Returns the bytes and type, or an error message. */
export async function readCover(f: File): Promise<{ body: Buffer; type: string; ext: string } | string> {
  if (f.size > LIMITS.cover) return `Use a cover image under ${formatMb(LIMITS.cover)}.`;
  const body = Buffer.from(await f.arrayBuffer());
  const entry = Object.entries(IMAGE_TYPES).find(([, t]) => t.magic(body));
  if (!entry) return "Use a JPG, PNG or WebP image for the cover.";
  return { body, type: entry[0], ext: entry[1].ext };
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export async function uniqueId(base: string): Promise<string> {
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

export interface RaceInput {
  event: string;
  category: string;
  date: string;
  country: { code: string; name: string };
  city: string;
  bib: string;
  officialUrl: string;
  startTime: string;
  distance: DistanceValue;
  officialKm: number;
  stations: Station[];
  stationsApproximate: boolean;
  gpx: string | null;
  pdf: Buffer | null;
  cover: { body: Buffer; type: string; ext: string } | null;
  removePdf: boolean;
  removeCover: boolean;
}

/** Checks the race form fields. tooLarge marks a request over the total file limit. */
export async function parseRaceInput(
  fd: FormData,
  opts: { requireGpx: boolean },
): Promise<{ input: RaceInput } | (FormState & { tooLarge?: boolean })> {
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
  if (total > LIMITS.total)
    return { error: `The files add up to ${formatMb(total)}. Keep them under ${formatMb(LIMITS.total)} in total.`, tooLarge: true };

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
  } else if (opts.requireGpx) fieldErrors.gpx = "Add the course GPX.";

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
  return {
    input: {
      event,
      category,
      date,
      country: country!,
      city,
      bib,
      officialUrl,
      startTime,
      distance,
      officialKm,
      stations: stations!,
      stationsApproximate: text(fd, "stationsApproximate") === "on",
      gpx,
      pdf,
      cover: cover as RaceInput["cover"],
      removePdf: text(fd, "removePdf") === "on",
      removeCover: text(fd, "removeCover") === "on",
    },
  };
}

/**
 * Saves the files and record for a checked race and removes the files it replaced.
 * Without a GPX (none sent and none stored) the race is upcoming: listed, but with no course yet.
 * Storage failures throw.
 */
export async function writeRace(
  input: RaceInput,
  id: string,
  existing: StoredRace | null,
  /** Who owns it and whether it is public; kept from `existing` by the callers on edits. */
  meta: Pick<StoredRace, "owner" | "ownerName" | "publishedBy" | "publishedAt" | "announcedAt">,
): Promise<{ race: StoredRace } | FormState> {
  const courseGpx = input.gpx ?? (existing?.gpxUrl ? await readText(existing.gpxUrl) : null);
  let facts;
  if (courseGpx) {
    try {
      facts = cardFacts(input.event, courseGpx, input.officialKm, input.stations);
    } catch (e) {
      return { error: "Some details need another look.", fieldErrors: { gpx: `This GPX could not be used: ${(e as Error).message}.` } };
    }
  }

  const replaced: string[] = [];
  let gpxUrl = existing?.gpxUrl;
  if (input.gpx) {
    if (gpxUrl) replaced.push(gpxUrl);
    gpxUrl = await saveFile(`races/${id}/course.gpx`, input.gpx, "application/gpx+xml", { randomSuffix: true });
  }
  let pdfUrl = existing?.pdfUrl;
  if (input.pdf) {
    if (pdfUrl) replaced.push(pdfUrl);
    pdfUrl = await saveFile(`races/${id}/route-map.pdf`, input.pdf, "application/pdf", { randomSuffix: true });
  } else if (input.removePdf && pdfUrl) {
    replaced.push(pdfUrl);
    pdfUrl = undefined;
  }
  let coverUrl = existing?.coverUrl;
  if (input.cover) {
    if (coverUrl) replaced.push(coverUrl);
    coverUrl = await saveFile(`races/${id}/cover.${input.cover.ext}`, input.cover.body, input.cover.type, { randomSuffix: true });
  } else if (input.removeCover && coverUrl) {
    replaced.push(coverUrl);
    coverUrl = undefined;
  }

  const race: StoredRace = {
    kind: "stored",
    id,
    status: gpxUrl ? "ready" : "upcoming",
    event: input.event,
    category: input.category,
    date: input.date,
    dateLabel: dateLabelOf(input.date),
    location: `${input.city}, ${input.country.name}`,
    country: input.country.code,
    city: input.city,
    bib: input.bib || undefined,
    officialUrl: input.officialUrl,
    distance: input.distance,
    officialKm: input.officialKm,
    startTime: input.startTime || undefined,
    stations: input.stations,
    stationsApproximate: input.stationsApproximate,
    gpxUrl,
    pdfUrl,
    coverUrl,
    facts,
    ...meta,
    updatedAt: Date.now(),
  };
  await saveRecord(race);
  await deleteFiles(replaced);
  return { race };
}

/** The races API answer for a failed save or read: storage errors say what to fix, anything else stays generic. */
export function apiFailure(e: unknown): Response {
  if (e instanceof StorageError || e instanceof StorageNotReadyError) return Response.json({ error: e.message }, { status: 502 });
  console.error(e);
  return Response.json({ error: "The race could not be saved. Try again in a moment." }, { status: 500 });
}

/** Who the activity log and announcement emails name for races API changes. */
export const API_ACTOR = "races-api";
