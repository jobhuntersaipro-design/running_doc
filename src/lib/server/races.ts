import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RACES, getRace } from "@/lib/courses";
import { sameRace } from "@/lib/courses/distance";
import type { RaceFile, RaceMeta } from "@/lib/courses/types";
import { buildPlan, routePreview, type Station } from "@/lib/planner";
import { deleteFiles, listFiles, readText, saveFile } from "./store";

/** Card facts worked out once from the course, so the overview stays fast. */
export interface CardFacts {
  gainM: number;
  drinkStops: number;
  preview: { d: string; start: [number, number]; finish: [number, number] };
}

/** A race added in /admin. */
export interface StoredRace {
  kind: "stored";
  id: string;
  event: string;
  category: string;
  /** "YYYY-MM-DD" */
  date: string;
  dateLabel: string;
  /** "City, Country", shown on the card and the plan. */
  location: string;
  /** ISO country code and city, kept apart for the form. Older races have only `location`. */
  country?: string;
  city?: string;
  /** The runner's own bib number, shown only to them. */
  bib?: string;
  officialUrl: string;
  distance: "5k" | "10k" | "half" | "full" | "custom";
  officialKm: number;
  startTime?: string;
  stations: Station[];
  stationsApproximate: boolean;
  gpxUrl: string;
  pdfUrl?: string;
  coverUrl?: string;
  facts: CardFacts;
  /** Email of the runner who added it. Their races are private to them until published; admin races have no owner and are public. */
  owner?: string;
  /** Set when a runner publishes their race for everyone: the name shown as "published by". */
  publishedBy?: string;
  publishedAt?: number;
  updatedAt: number;
}

/** A cover image added in /admin for one of the built-in races. */
export interface CoverOverride {
  kind: "cover";
  id: string;
  coverUrl?: string;
  updatedAt: number;
}

type RaceRecord = StoredRace | CoverOverride;

/** What the overview card shows. */
export interface RaceCard extends CardFacts {
  id: string;
  event: string;
  category: string;
  dateLabel: string;
  date?: string;
  location: string;
  startTime?: string;
  officialUrl: string;
  files: RaceFile[];
  km: number;
  coverUrl?: string;
  builtIn: boolean;
  /** Added by a runner and not published, so only they (and the admin) can see it. */
  private: boolean;
  owner?: string;
  publishedBy?: string;
}

/** Who is looking: private races show only to their owner, or to the admin. */
export interface Viewer {
  email: string;
  admin: boolean;
}

export const canSee = (r: StoredRace, viewer: Viewer | null) =>
  !r.owner || r.publishedAt !== undefined || (viewer !== null && (viewer.admin || viewer.email.toLowerCase() === r.owner.toLowerCase()));

const recordKey = (id: string) => `races/${id}/race.json`;

export function cardFacts(name: string, gpx: string, officialKm: number, stations: Station[]): CardFacts {
  // Any goal gives the same course facts; pace does not change the hills or stations.
  const plan = buildPlan({ name, gpx, officialKm, goalSeconds: officialKm * 340, stations });
  return {
    gainM: Math.round(plan.summary.totalGain),
    drinkStops: plan.events.filter((e) => e.type === "drink").length,
    preview: routePreview(plan.track, 320, 180, 14),
  };
}

/** Latest record for each race id. */
async function loadRecords(): Promise<Map<string, RaceRecord>> {
  const files = (await listFiles("races/")).filter((f) => /^races\/[^/]+\/race(-[^/]*)?\.json$/.test(f.key));
  const records = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await readText(f.url)) as RaceRecord;
      } catch {
        return null;
      }
    }),
  );
  const out = new Map<string, RaceRecord>();
  for (const r of records) {
    if (!r || typeof r.id !== "string") continue;
    const prev = out.get(r.id);
    if (!prev || r.updatedAt > prev.updatedAt) out.set(r.id, r);
  }
  return out;
}

/**
 * Saves a record. Each save is a new file (public files can be cached at the
 * edge, so overwriting in place could serve the old version for a while), and
 * older copies are removed afterwards.
 */
export async function saveRecord(record: RaceRecord): Promise<void> {
  const before = (await listFiles(`races/${record.id}/`)).filter((f) => /\/race(-[^/]*)?\.json$/.test(f.key));
  const url = await saveFile(recordKey(record.id), JSON.stringify(record, null, 2), "application/json", { randomSuffix: true });
  await deleteFiles(before.map((f) => f.url).filter((u) => u !== url));
}

/** Every race added in /admin or by runners. */
export async function listRaces(): Promise<StoredRace[]> {
  return [...(await loadRecords()).values()].filter((r): r is StoredRace => r.kind === "stored" && !getRace(r.id));
}

export async function getStoredRace(id: string): Promise<StoredRace | null> {
  const r = (await loadRecords()).get(id);
  return r?.kind === "stored" ? r : null;
}

export async function getCoverOverride(id: string): Promise<CoverOverride | null> {
  const r = (await loadRecords()).get(id);
  return r?.kind === "cover" ? r : null;
}

/** Removes every file stored for a race id: the record, course, map and cover. */
export async function deleteRaceFiles(id: string): Promise<void> {
  const files = await listFiles(`races/${id}/`);
  await deleteFiles(files.map((f) => f.url));
}

function filesOf(r: StoredRace): RaceFile[] {
  const files: RaceFile[] = [{ label: "Course GPX", href: r.gpxUrl, kind: "gpx" }];
  if (r.pdfUrl) files.push({ label: "Official route map (PDF)", href: r.pdfUrl, kind: "pdf" });
  return files;
}

/** GPX of a built-in race, from public/races/<id>/course.gpx. */
export async function builtInGpx(race: RaceMeta): Promise<string> {
  return readFile(path.join(process.cwd(), "public", "races", race.id, "course.gpx"), "utf8");
}

/** Every race for the overview, built-in and added in /admin, soonest first. */
export async function overviewRaces(viewer: Viewer | null): Promise<RaceCard[]> {
  const records = await loadRecords().catch(() => new Map<string, RaceRecord>());
  const builtIn = await Promise.all(
    RACES.map(async (race): Promise<RaceCard> => {
      const override = records.get(race.id);
      return {
        ...cardFacts(race.name, await builtInGpx(race), race.officialKm, race.stations),
        id: race.id,
        event: race.event,
        category: race.category,
        dateLabel: race.dateLabel,
        date: race.date,
        location: race.location,
        startTime: race.startTime,
        officialUrl: race.officialUrl,
        files: race.files,
        km: race.officialKm,
        coverUrl: override?.kind === "cover" ? override.coverUrl : undefined,
        builtIn: true,
        private: false,
      };
    }),
  );
  const stored = [...records.values()]
    .filter((r): r is StoredRace => r.kind === "stored" && !getRace(r.id) && canSee(r, viewer))
    .map(
      (r): RaceCard => ({
        ...r.facts,
        id: r.id,
        event: r.event,
        category: r.category,
        dateLabel: r.dateLabel,
        date: r.date,
        location: r.location,
        startTime: r.startTime,
        officialUrl: r.officialUrl,
        files: filesOf(r),
        km: r.officialKm,
        coverUrl: r.coverUrl,
        builtIn: false,
        private: Boolean(r.owner) && r.publishedAt === undefined,
        owner: r.owner,
        publishedBy: r.publishedBy,
      }),
    );
  return [...builtIn, ...stored].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/** A stored race in the shape the planner page needs, with its GPX loaded. */
export async function storedRaceForPlanner(id: string, viewer: Viewer | null) {
  const r = await getStoredRace(id);
  if (!r || !canSee(r, viewer)) return null;
  // The bib belongs to whoever added the race: the runner, or the admin for admin races.
  const mine = viewer !== null && (r.owner ? r.owner.toLowerCase() === viewer.email.toLowerCase() : viewer.admin);
  const gpx = await readText(r.gpxUrl);
  return {
    id: r.id,
    name: `${r.event}, ${r.category}`,
    officialKm: r.officialKm,
    gpx,
    stations: r.stations,
    stationsApproximate: r.stationsApproximate,
    startTime: r.startTime,
    event: r.event,
    category: r.category,
    dateLabel: r.dateLabel,
    location: r.location,
    officialUrl: r.officialUrl,
    files: filesOf(r),
    publishedBy: r.publishedBy,
    bib: mine ? r.bib : undefined,
  };
}

/** The public race (built in, added by the admin or published by a runner) that this one would duplicate, if any. */
export async function publishedTwin(r: StoredRace): Promise<RaceCard | null> {
  const me = { event: r.event, date: r.date, km: r.officialKm };
  return (await overviewRaces(null)).find((c) => c.id !== r.id && sameRace(c, me)) ?? null;
}

/** One event on the overview, such as a city marathon, with each distance it offers. */
export interface RaceEvent {
  key: string;
  event: string;
  dateLabel: string;
  date?: string;
  location: string;
  officialUrl: string;
  /** The race the card opens and shows: the one with a cover, else the longest. */
  main: RaceCard;
  /** Every distance, shortest first. */
  races: RaceCard[];
  private: boolean;
  publishedBy?: string;
}

/** Races with the same key are distances of one event: same name, and the same runner if private. */
export const eventKey = (r: { event: string; private: boolean; owner?: string }) =>
  `${r.private ? r.owner!.toLowerCase() : ""}|${r.event.trim().toLowerCase().replace(/\s+/g, " ")}`;

/**
 * Groups races by event name, so a 10K and a half marathon added under the same
 * event share one card. A runner's private races group on their own.
 */
export function groupByEvent(races: RaceCard[]): RaceEvent[] {
  const groups = new Map<string, RaceCard[]>();
  for (const r of races) {
    const key = eventKey(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.km - b.km);
      const main = sorted.find((r) => r.coverUrl) ?? sorted[sorted.length - 1];
      const date = sorted.map((r) => r.date).filter(Boolean).sort()[0];
      return {
        key,
        event: main.event,
        dateLabel: (sorted.find((r) => r.date === date) ?? main).dateLabel,
        date,
        location: main.location,
        officialUrl: main.officialUrl,
        main,
        races: sorted,
        private: main.private,
        publishedBy: main.publishedBy,
      };
    })
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/** Event names to suggest in the race form: public events for the admin, a runner's own events for them. */
export async function eventNames(viewer: Viewer): Promise<string[]> {
  const races = await overviewRaces(viewer).catch(() => []);
  const own = races.filter((r) => (viewer.admin ? !r.owner : r.owner?.toLowerCase() === viewer.email.toLowerCase()));
  return [...new Set(own.map((r) => r.event))].sort();
}
