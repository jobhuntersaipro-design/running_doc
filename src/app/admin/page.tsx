import type { Metadata } from "next";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { RunnersTable } from "@/components/admin/runners-table";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, getUser, isAdmin } from "@/lib/server/auth";
import { formatClock, formatPace, type SavedGoal } from "@/lib/planner";
import { overviewRaces } from "@/lib/server/races";
import { listRunners } from "@/lib/server/runners";
import { checkStorage } from "@/lib/server/store";
import styles from "@/components/admin/admin.module.css";

const savedOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

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
  const rows = runners?.map((r) => {
    const goal = (id: string, g: SavedGoal) => {
      const c = races.find((x) => x.id === id);
      const pace = c ? ` (${formatPace(g.goalSeconds / c.km)}/km)` : "";
      return `Goal: ${c ? `${c.event}, ${c.category}` : id}, ${formatClock(g.goalSeconds)}${pace}, start ${g.startTime}, saved ${savedOn.format(new Date(g.savedAt))}`;
    };
    const p = r.profile;
    const profile = p && [p.age && `${p.age} y`, p.sex, p.heightCm && `${p.heightCm} cm`, p.weightKg && `${p.weightKg} kg`, p.vo2max && `VO2 max ${p.vo2max}`].filter(Boolean).join(", ");
    return {
      ...r,
      goalCount: Object.keys(r.goals).length,
      details: [
        `Profile: ${profile || "not saved"}`,
        ...Object.entries(r.goals).map(([id, g]) => goal(id, g)),
        ...races.filter((x) => x.owner?.toLowerCase() === r.email).map((x) => `Added race: ${x.event}, ${x.category}`),
      ],
    };
  });
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
      {rows && runners ? (
        <section aria-labelledby="runners-heading">
          <h2 id="runners-heading" className={styles.h2}>
            Runners ({runners.length})
          </h2>
          <RunnersTable runners={rows} />
        </section>
      ) : null}
    </AdminShell>
  );
}
