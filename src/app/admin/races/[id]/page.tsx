import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { CoverForm } from "@/components/admin/cover-form";
import { RaceForm } from "@/components/admin/race-form";
import { getRace } from "@/lib/courses";
import { isAdmin } from "@/lib/server/auth";
import { getCoverOverride, getStoredRace } from "@/lib/server/races";

export const metadata: Metadata = { title: "Edit race", robots: { index: false, follow: false } };

export default async function EditRacePage(props: PageProps<"/admin/races/[id]">) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await props.params;
  const builtIn = getRace(id);
  if (builtIn) {
    const override = await getCoverOverride(id);
    return (
      <AdminShell signedIn back>
        <CoverForm id={id} name={builtIn.event} coverUrl={override?.coverUrl} />
      </AdminShell>
    );
  }
  const race = await getStoredRace(id);
  if (!race) notFound();
  return (
    <AdminShell signedIn back>
      <RaceForm race={race} />
    </AdminShell>
  );
}
