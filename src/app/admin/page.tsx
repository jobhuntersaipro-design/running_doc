import type { Metadata } from "next";
import Link from "next/link";
import { ImagePlus, Pencil, Plus } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { DeleteRace } from "@/components/admin/delete-race";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, isAdmin } from "@/lib/server/auth";
import { overviewRaces } from "@/lib/server/races";
import { storageReady } from "@/lib/server/store";
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
  const races = await overviewRaces();
  return (
    <AdminShell signedIn>
      <section className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Races</h1>
          <p className={styles.lede}>Add a race with its course, files and cover. It appears on the overview straight away.</p>
        </div>
        <Link href="/admin/races/new" className={styles.primaryLink}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New race
        </Link>
      </section>

      {saved ? (
        <Alert tone="success" title="Saved">
          The overview shows the latest details now.
        </Alert>
      ) : null}

      {!storageReady() ? (
        <p className={styles.notice} role="status">
          File storage is not set up, so new races cannot be saved. Add the R2 settings to the environment variables, then redeploy.
        </p>
      ) : null}

      <ul className={styles.raceList} aria-label="Races">
        {races.map((r) => (
          <li key={r.id} className={styles.raceRow}>
            <div className={styles.thumb}>
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt="" />
              ) : (
                <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
              )}
            </div>
            <div className={styles.raceText}>
              <Link href={`/races/${r.id}`} className={styles.raceName}>
                {r.event}
              </Link>
              <span className={styles.raceMeta}>
                {r.category}, {r.dateLabel}
                {r.builtIn ? ", built in" : ""}
              </span>
            </div>
            <div className={styles.rowActions}>
              <Link href={`/admin/races/${r.id}`} className={styles.ghostLink}>
                {r.builtIn ? <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />}
                {r.builtIn ? "Cover" : "Edit"}
              </Link>
              {r.builtIn ? null : <DeleteRace id={r.id} name={r.event} />}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
