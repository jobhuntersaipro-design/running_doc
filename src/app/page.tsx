import { readFile } from "node:fs/promises";
import path from "node:path";
import { Planner } from "@/components/planner/planner";
import { klscm2026Hm } from "@/lib/courses/klscm-2026-hm";

export default async function Home() {
  const gpx = await readFile(path.join(process.cwd(), "data", "klscm-2026-hm", "course.gpx"), "utf8");
  return <Planner example={{ ...klscm2026Hm, gpx }} />;
}
