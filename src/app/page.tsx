import { Overview } from "@/components/overview/overview";
import { overviewRaces } from "@/lib/server/races";

// Races added in /admin appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  return <Overview races={await overviewRaces()} />;
}
