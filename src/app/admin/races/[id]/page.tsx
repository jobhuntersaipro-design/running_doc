import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { AdminShell } from "@/components/admin/admin-shell";
import { CoverForm } from "@/components/admin/cover-form";
import { RaceForm } from "@/components/admin/race-form";
import { getRace } from "@/lib/courses";
import { isAdmin } from "@/lib/server/auth";
import { getCoverOverride, getStoredRace, type CoverOverride, type StoredRace } from "@/lib/server/races";
import { StorageError } from "@/lib/server/store";

export const metadata: Metadata = { title: "Edit race", robots: { index: false, follow: false } };

export default async function EditRacePage(props: PageProps<"/admin/races/[id]">) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await props.params;
  const builtIn = getRace(id);

  let record: CoverOverride | StoredRace | null;
  try {
    record = builtIn ? await getCoverOverride(id) : await getStoredRace(id);
  } catch (e) {
    console.error(e);
    return (
      <AdminShell signedIn back>
        <Alert tone="danger" title="File storage is not working">
          {e instanceof StorageError ? e.message : "The race could not be loaded from storage. Check the R2 settings."}
        </Alert>
      </AdminShell>
    );
  }

  if (builtIn) {
    return (
      <AdminShell signedIn back>
        <CoverForm id={id} name={builtIn.event} coverUrl={record?.coverUrl} />
      </AdminShell>
    );
  }
  if (record?.kind !== "stored") notFound();
  return (
    <AdminShell signedIn back>
      <RaceForm race={record} />
    </AdminShell>
  );
}
