import { Overview } from "@/components/overview/overview";
import { getUser } from "@/lib/server/auth";
import { likeCounts } from "@/lib/server/likes";
import { groupByEvent, overviewRaces } from "@/lib/server/races";

// Races added in /admin appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  const [races, likes] = await Promise.all([
    overviewRaces(user),
    likeCounts(user?.email).catch((e): Awaited<ReturnType<typeof likeCounts>> => {
      console.error("Reading likes failed:", e);
      return {};
    }),
  ]);
  return <Overview events={groupByEvent(races)} likes={likes} viewerEmail={user?.email} isAdmin={user?.admin} />;
}
