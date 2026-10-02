import { Overview, DISTANCE_TABS } from "@/components/overview/overview";
import { getUser } from "@/lib/server/auth";
import { overviewRaces } from "@/lib/server/races";

// Races added in /admin appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const { distance } = await props.searchParams;
  const tab = DISTANCE_TABS.find((t) => t.value === distance) ?? DISTANCE_TABS[0];
  const user = await getUser();
  return <Overview races={await overviewRaces(user)} signedIn={Boolean(user)} tab={tab.value} />;
}
