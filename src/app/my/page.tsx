import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { getUser } from "@/lib/server/auth";
import { listRaces } from "@/lib/server/races";
import { checkStorage } from "@/lib/server/store";

export const metadata: Metadata = { title: "My races", robots: { index: false, follow: false } };

export default async function MyRacesPage(props: PageProps<"/my">) {
  const user = await getUser();
  if (!user) redirect("/signin?next=/my");
  const { saved } = await props.searchParams;
  const [all, storage] = await Promise.all([listRaces().catch(() => []), checkStorage()]);
  const races = all
    .filter((r) => r.owner?.toLowerCase() === user.email.toLowerCase())
    .map((r) => ({ ...r, builtIn: false }));
  return (
    <AdminShell signedIn home="/my">
      <RaceDashboard
        title="My races"
        lede={`Signed in as ${user.email}. Races you add are only visible to you.`}
        base="/my"
        races={races}
        saved={Boolean(saved)}
        storage={storage}
        empty="No races yet. Add your race with its course GPX, route map and documents to get a full plan."
      />
    </AdminShell>
  );
}
