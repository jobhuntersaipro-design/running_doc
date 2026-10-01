import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceForm } from "@/components/admin/race-form";
import { isAdmin } from "@/lib/server/auth";

export const metadata: Metadata = { title: "New race", robots: { index: false, follow: false } };

export default async function NewRacePage() {
  if (!(await isAdmin())) redirect("/admin");
  return (
    <AdminShell signedIn back>
      <RaceForm race={null} />
    </AdminShell>
  );
}
