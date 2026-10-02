import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Planner } from "@/components/planner/planner";
import { getRace } from "@/lib/courses";
import { getUser } from "@/lib/server/auth";
import { linkPreview } from "@/lib/server/link-preview";
import { builtInGpx, canSee, getStoredRace, storedRaceForPlanner } from "@/lib/server/races";

// Races added in /admin come from storage, so every race page renders on request.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "custom") return { title: "Plan your own race" };
  const stored = getRace(id) ? null : await getStoredRace(id).catch(() => null);
  const event = getRace(id)?.event ?? (stored && canSee(stored, await getUser()) ? stored.event : undefined);
  return { title: event ? `${event}: race plan` : "Race not found" };
}

export default async function RacePage(props: PageProps<"/races/[id]">) {
  const { id } = await props.params;
  if (id === "custom") return <Planner race={null} />;
  const race = getRace(id);
  if (race) {
    const [gpx, officialPreview] = await Promise.all([builtInGpx(race), linkPreview(race.officialUrl)]);
    return <Planner race={{ ...race, gpx }} officialPreview={officialPreview} />;
  }
  const stored = await storedRaceForPlanner(id, await getUser()).catch(() => null);
  if (!stored) notFound();
  return <Planner race={stored} officialPreview={await linkPreview(stored.officialUrl)} />;
}
