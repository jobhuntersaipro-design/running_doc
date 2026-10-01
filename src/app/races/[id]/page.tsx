import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Planner } from "@/components/planner/planner";
import { RACES, getRace } from "@/lib/courses";

/** Every race in the overview, plus "custom" for an uploaded GPX. */
export function generateStaticParams() {
  return [...RACES.map((r) => ({ id: r.id })), { id: "custom" }];
}

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const race = getRace(id);
  return { title: race ? `${race.event}: race plan` : "Plan your own race" };
}

export default async function RacePage(props: PageProps<"/races/[id]">) {
  const { id } = await props.params;
  if (id === "custom") return <Planner race={null} />;
  const race = getRace(id);
  if (!race) notFound();
  const gpx = await readFile(path.join(process.cwd(), "public", "races", race.id, "course.gpx"), "utf8");
  return <Planner race={{ ...race, gpx }} />;
}
