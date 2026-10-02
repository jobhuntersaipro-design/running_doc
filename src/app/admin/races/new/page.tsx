import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceForm } from "@/components/admin/race-form";
import { getUser } from "@/lib/server/auth";
import { eventNames } from "@/lib/server/races";

export const metadata: Metadata = { title: "New race", robots: { index: false, follow: false } };

export default async function NewRacePage() {
  const user = await getUser();
  if (!user?.admin) redirect("/admin");
  return (
    <AdminShell signedIn back>
      <RaceForm race={null} events={await eventNames(user)} />
    </AdminShell>
  );
}
