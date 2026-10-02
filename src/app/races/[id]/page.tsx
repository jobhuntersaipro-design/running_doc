import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Planner } from "@/components/planner/planner";
import { getRace } from "@/lib/courses";
import { getUser } from "@/lib/server/auth";
import { linkPreview } from "@/lib/server/link-preview";
import { distanceName } from "@/lib/courses/distance";
import { builtInGpx, canSee, getStoredRace, groupByEvent, overviewRaces, storedRaceForPlanner, type Viewer } from "@/lib/server/races";

// Races added in /admin come from storage, so every race page renders on request.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "custom") return { title: "Plan your own race" };
  const stored = getRace(id) ? null : await getStoredRace(id).catch(() => null);
  const event = getRace(id)?.event ?? (stored && canSee(stored, await getUser()) ? stored.event : undefined);
  return { title: event ? `${event}: race plan` : "Race not found" };
}

/** The other distances of the same event, for the tabs at the top of the race page. */
async function distancesOf(id: string, viewer: Viewer | null) {
  const event = groupByEvent(await overviewRaces(viewer).catch(() => [])).find((e) => e.races.some((r) => r.id === id));
  const races = event?.races ?? [];
  // Two races at one distance (a 10K run and a 10K walk) are told apart by their category.
  const clash = (km: number) => races.filter((r) => distanceName(r.km) === distanceName(km)).length > 1;
  return races.map((r) => ({ id: r.id, label: clash(r.km) ? r.category : distanceName(r.km), current: r.id === id }));
}

export default async function RacePage(props: PageProps<"/races/[id]">) {
  const { id } = await props.params;
  if (id === "custom") return <Planner race={null} />;
  const race = getRace(id);
  if (race) {
    const [gpx, officialPreview, distances] = await Promise.all([builtInGpx(race), linkPreview(race.officialUrl), distancesOf(id, await getUser())]);
    return <Planner race={{ ...race, gpx }} officialPreview={officialPreview} distances={distances} />;
  }
  const user = await getUser();
  const stored = await storedRaceForPlanner(id, user).catch(() => null);
  if (!stored) notFound();
  const [officialPreview, distances] = await Promise.all([linkPreview(stored.officialUrl), distancesOf(id, user)]);
  return <Planner race={stored} officialPreview={officialPreview} distances={distances} />;
}
