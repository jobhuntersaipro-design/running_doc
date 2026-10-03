import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { SavedGoals } from "@/components/admin/saved-goals";
import { getUser } from "@/lib/server/auth";
import { listRaces, overviewRaces } from "@/lib/server/races";
import { getGoals } from "@/lib/server/runners";
import { checkStorage } from "@/lib/server/store";

export const metadata: Metadata = { title: "My races", robots: { index: false, follow: false } };

export default async function MyRacesPage(props: PageProps<"/my">) {
  const user = await getUser();
  if (!user) redirect("/signin?next=/my");
  const { saved: raceSaved } = await props.searchParams;
  const [all, storage, goals, cards] = await Promise.all([
    listRaces().catch(() => []),
    checkStorage(),
    getGoals(user.email).catch((e): Awaited<ReturnType<typeof getGoals>> => {
      console.error("Reading saved goals failed:", e);
      return {};
    }),
    overviewRaces(user).catch(() => []),
  ]);
  const saved = cards
    .filter((race) => goals[race.id])
    .map((race) => ({ race, goal: goals[race.id] }))
    .sort((a, b) => b.goal.savedAt.localeCompare(a.goal.savedAt));
  const races = all
    .filter((r) => r.owner?.toLowerCase() === user.email.toLowerCase())
    .map((r) => ({ ...r, builtIn: false }));
  return (
    <AdminShell signedIn home="/my">
      <RaceDashboard
        title="My races"
        lede={`Signed in as ${user.email}. Races you add are only visible to you until you publish them.`}
        base="/my"
        races={races}
        saved={Boolean(raceSaved)}
        storage={storage}
        empty="No races added yet. Add your race with its course GPX, route map and documents to get a full plan."
      >
        <SavedGoals goals={saved} />
      </RaceDashboard>
    </AdminShell>
  );
}
