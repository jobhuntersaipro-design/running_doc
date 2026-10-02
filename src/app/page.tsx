import { Overview } from "@/components/overview/overview";
import { getUser } from "@/lib/server/auth";
import { groupByEvent, overviewRaces } from "@/lib/server/races";

// Races added in /admin appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  return <Overview events={groupByEvent(await overviewRaces(user))} signedIn={Boolean(user)} />;
}
