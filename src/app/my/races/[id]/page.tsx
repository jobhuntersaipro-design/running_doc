import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceForm } from "@/components/admin/race-form";
import { getUser } from "@/lib/server/auth";
import { eventNames, getStoredRace, type StoredRace } from "@/lib/server/races";
import { StorageError } from "@/lib/server/store";

export const metadata: Metadata = { title: "Edit race", robots: { index: false, follow: false } };

export default async function EditMyRacePage(props: PageProps<"/my/races/[id]">) {
  const { id } = await props.params;
  const user = await getUser();
  if (!user) redirect(`/signin?next=/my/races/${id}`);
  let race: StoredRace | null;
  try {
    race = await getStoredRace(id);
  } catch (e) {
    return (
      <AdminShell signedIn back home="/my">
        <Alert tone="danger" title="File storage is not working">
          {e instanceof StorageError ? e.message : "The race could not be loaded. Try again in a moment."}
        </Alert>
      </AdminShell>
    );
  }
  if (!race || race.owner?.toLowerCase() !== user.email.toLowerCase()) notFound();
  return (
    <AdminShell signedIn back home="/my">
      <RaceForm race={race} events={await eventNames(user)} />
    </AdminShell>
  );
}
