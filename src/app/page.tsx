import { readFile } from "node:fs/promises";
import path from "node:path";
import { Overview, type RaceCardData } from "@/components/overview/overview";
import { RACES } from "@/lib/courses";
import { buildPlan, routePreview } from "@/lib/planner";

export default async function Home() {
  const races: RaceCardData[] = await Promise.all(
    RACES.map(async (race) => {
      const gpx = await readFile(path.join(process.cwd(), "public", "races", race.id, "course.gpx"), "utf8");
      // Any goal gives the same course facts; pace does not change the hills or stations.
      const plan = buildPlan({ name: race.name, gpx, officialKm: race.officialKm, goalSeconds: race.officialKm * 340, stations: race.stations });
      const preview = routePreview(plan.track, 320, 180, 14);
      return {
        id: race.id,
        event: race.event,
        category: race.category,
        dateLabel: race.dateLabel,
        location: race.location,
        startTime: race.startTime,
        officialUrl: race.officialUrl,
        files: race.files,
        km: race.officialKm,
        gainM: Math.round(plan.summary.totalGain),
        drinkStops: plan.events.filter((e) => e.type === "drink").length,
        preview,
      };
    }),
  );
  return <Overview races={races} />;
}
