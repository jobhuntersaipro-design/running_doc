import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceForm } from "@/components/admin/race-form";
import { getUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add your race", robots: { index: false, follow: false } };

export default async function NewMyRacePage() {
  if (!(await getUser())) redirect("/signin?next=/my/races/new");
  return (
    <AdminShell signedIn back home="/my">
      <RaceForm race={null} />
    </AdminShell>
  );
}
