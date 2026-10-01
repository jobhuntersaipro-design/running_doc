import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Planner } from "@/components/planner/planner";
import { getRace } from "@/lib/courses";
import { builtInGpx, getStoredRace, storedRaceForPlanner } from "@/lib/server/races";

// Races added in /admin come from storage, so every race page renders on request.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "custom") return { title: "Plan your own race" };
  const event = getRace(id)?.event ?? (await getStoredRace(id).catch(() => null))?.event;
  return { title: event ? `${event}: race plan` : "Race not found" };
}

export default async function RacePage(props: PageProps<"/races/[id]">) {
  const { id } = await props.params;
  if (id === "custom") return <Planner race={null} />;
  const race = getRace(id);
  if (race) {
    const gpx = await builtInGpx(race);
    return <Planner race={{ ...race, gpx }} />;
  }
  const stored = await storedRaceForPlanner(id).catch(() => null);
  if (!stored) notFound();
  return <Planner race={stored} />;
}
