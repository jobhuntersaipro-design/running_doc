import type { Metadata } from "next";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { RunnersTable } from "@/components/admin/runners-table";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, getUser, isAdmin } from "@/lib/server/auth";
import { overviewRaces } from "@/lib/server/races";
import { listRunners } from "@/lib/server/runners";
import { checkStorage } from "@/lib/server/store";
import styles from "@/components/admin/admin.module.css";

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
    listRunners().catch((e) => {
      console.error("Listing runners failed:", e);
      return null;
    }),
  ]);
  return (
    <AdminShell signedIn>
      <RaceDashboard
        title="Races"
        lede="Add a race with its course, files and cover. Races you add appear on the overview for everyone."
        base="/admin"
        races={races}
        saved={Boolean(saved)}
        storage={storage}
      />
      {runners ? (
        <section aria-labelledby="runners-heading">
          <h2 id="runners-heading" className={styles.h2}>
            Runners ({runners.length})
          </h2>
          <RunnersTable runners={runners} />
        </section>
      ) : null}
    </AdminShell>
  );
}
