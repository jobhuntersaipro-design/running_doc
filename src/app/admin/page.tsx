import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceDashboard } from "@/components/admin/race-dashboard";
import { RunnersTable, type RunnerRow } from "@/components/admin/runners-table";
import { ActivityFeed, RacePanel, RunnerPanel, type AdminData } from "@/components/admin/admin-panels";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, getUser, isAdmin } from "@/lib/server/auth";
import { commentsOverview, listEvents } from "@/lib/server/activity";
import { likeCounts } from "@/lib/server/likes";
import { getStoredRace, groupByEvent, overviewRaces } from "@/lib/server/races";
import { listRunners } from "@/lib/server/runners";
import { checkStorage } from "@/lib/server/store";
import styles from "@/components/admin/admin.module.css";

const logged = <T,>(what: string) => (e: unknown): T | null => {
  console.error(`${what} failed:`, e);
  return null;
};
const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
const WEEK = 7 * 24 * 3600 * 1000;

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

  const { saved, tab: tabParam, race: raceId, runner: runnerEmail, published } = await props.searchParams;
  const tab = tabParam === "runners" || runnerEmail ? "runners" : "races";
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const raceSel = one(raceId);
  const runnerSel = one(runnerEmail)?.toLowerCase();
  const [races, storage, runners, talk, events, stored, likes] = await Promise.all([
    overviewRaces(await getUser()),
    checkStorage(),
    listRunners().catch(logged<Awaited<ReturnType<typeof listRunners>>>("Listing runners")),
    commentsOverview().catch(logged<Awaited<ReturnType<typeof commentsOverview>>>("Listing comments")),
    listEvents(raceSel ? { raceId: raceSel } : runnerSel ? { email: runnerSel } : {}).catch(logged<Awaited<ReturnType<typeof listEvents>>>("Listing activity")),
    raceSel ? getStoredRace(raceSel).catch(() => null) : null,
    likeCounts().catch(logged<Awaited<ReturnType<typeof likeCounts>>>("Reading likes")),
  ]);
  const data: AdminData = { races, runners: runners ?? [], comments: talk?.comments ?? [], reactionsGiven: talk?.reactionsGiven ?? {}, likes: likes ?? {} };

  const stats = Object.fromEntries(
    races.map((r) => {
      const goals = data.runners.filter((u) => u.goals[r.id]).length;
      const comments = data.comments.filter((c) => c.raceId === r.id);
      return [r.id, { goals, comments: comments.length, reactions: comments.reduce((n, c) => n + sum(c.counts), 0) }];
    }),
  );
  // eslint-disable-next-line react-hooks/purity -- a server render; counts "the last 7 days".
  const weekAgo = Date.now() - WEEK;
  const rows: RunnerRow[] = data.runners.map((r) => ({
    ...r,
    activity: Date.parse(r.signedUpAt) > weekAgo ? "New" : Date.parse(r.lastSignInAt) > weekAgo ? "Active" : "Inactive",
    goalCount: Object.keys(r.goals).length,
    raceCount: races.filter((x) => x.owner?.toLowerCase() === r.email).length,
    commentCount: data.comments.filter((c) => c.email === r.email).length,
    reactionCount: data.reactionsGiven[r.email] ?? 0,
  }));
  const race = raceSel ? races.find((r) => r.id === raceSel) : undefined;
  const runner = runnerSel ? data.runners.find((r) => r.email === runnerSel) : undefined;

  return (
    <AdminShell signedIn>
      <nav className={styles.tabs} aria-label="Admin sections">
        <Link href="/admin" className={styles.tab} aria-current={tab === "races" ? "page" : undefined}>
          Races ({groupByEvent(races).length})
        </Link>
        <Link href="/admin?tab=runners" className={styles.tab} aria-current={tab === "runners" ? "page" : undefined}>
          Runners ({data.runners.length})
        </Link>
      </nav>

      {tab === "races" ? (
        <>
          {raceSel && !race ? <p className={styles.notice}>That race no longer exists.</p> : null}
          {race ? <RacePanel race={race} stored={stored} data={data} events={events} /> : null}
          <RaceDashboard
            title="Races"
            lede="Add a race with its course, files and cover. Races you add appear on the overview for everyone. Open Details for who published a race, runners' goals, comments and its log."
            base="/admin"
            races={races}
            saved={Boolean(saved)}
            storage={storage}
            stats={stats}
            published={one(published)}
            likes={Object.fromEntries(Object.entries(data.likes).map(([k, v]) => [k, v.count]))}
          />
        </>
      ) : !runners ? (
        <p className={styles.notice}>Runners are listed once the database is set up (DATABASE_URL).</p>
      ) : (
        <>
          <section className={styles.head}>
            <div className={styles.headText}>
              <h1 className={styles.title}>Runners</h1>
              <p className={styles.lede}>Everyone who signed in with Google. Open a name for their goals, races, comments and activity.</p>
            </div>
          </section>
          <div className={styles.metrics}>
            <MetricCard label="Runners" value={rows.length} context={`${rows.filter((r) => Date.parse(r.signedUpAt) > weekAgo).length} new in the last 7 days`} />
            <MetricCard label="Active" value={rows.filter((r) => Date.parse(r.lastSignInAt) > weekAgo).length} context="signed in during the last 7 days" />
            <MetricCard label="Goals saved" value={rows.reduce((n, r) => n + r.goalCount, 0)} context={`by ${rows.filter((r) => r.goalCount).length} of ${rows.length} runners`} />
            <MetricCard label="Comments" value={data.comments.length} context={`${data.comments.filter((c) => Date.parse(c.createdAt) > weekAgo).length} in the last 7 days`} />
          </div>
          {runnerSel && !runner ? <p className={styles.notice}>No runner with that email.</p> : null}
          {runner ? <RunnerPanel runner={runner} data={data} events={events} /> : null}
          <RunnersTable runners={rows} />
          {runner ? null : (
            <section aria-labelledby="activity-heading">
              <h2 id="activity-heading" className={styles.h2}>
                Activity
              </h2>
              <ActivityFeed events={events} data={data} label="Activity of all runners" />
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
}
