import type { Metadata } from "next";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, getUser, isAdmin } from "@/lib/server/auth";
import { overviewRaces } from "@/lib/server/races";
import { countRunners } from "@/lib/server/runners";
import { checkStorage } from "@/lib/server/store";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage(props: PageProps<"/admin">) {
  if (!adminConfigured()) {
    return (
      <AdminShell>
        <EmptyState
          title="Admin is not set up yet"
          description="Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and AUTH_SECRET in the environment, then restart or redeploy. Make the hash with: node scripts/hash-password.mjs"
        />
      </AdminShell>
    );
  }
  if (!(await isAdmin())) {
    return (
      <AdminShell>
        <LoginForm />
      </AdminShell>
    );
  }

  const { saved } = await props.searchParams;
  const [races, storage, runners] = await Promise.all([
    overviewRaces(await getUser()),
    checkStorage(),
    countRunners().catch((e) => {
      console.error("Counting runners failed:", e);
      return null;
    }),
  ]);
  return (
    <AdminShell signedIn>
      <RaceDashboard
        title="Races"
        lede={`Add a race with its course, files and cover. Races you add appear on the overview for everyone.${
          runners === null ? "" : ` ${runners} ${runners === 1 ? "runner has" : "runners have"} signed up.`
        }`}
        base="/admin"
        races={races}
        saved={Boolean(saved)}
        storage={storage}
      />
    </AdminShell>
  );
}
