import Link from "next/link";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Timeline, type TimelineEvent } from "@/components/arc/timeline/timeline";
import { formatClock, formatPace, type SavedGoal } from "@/lib/planner";
import { EVENT_KINDS, type ActivityEvent, type AdminComment } from "@/lib/server/activity";
import type { RaceCard, StoredRace } from "@/lib/server/races";
import type { Runner } from "@/lib/server/runners";
import { DeleteComment } from "./delete-comment";
import styles from "./admin.module.css";

const TZ = "Asia/Kuala_Lumpur";
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dayTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

export const runnerHref = (email: string) => `/admin?tab=runners&runner=${encodeURIComponent(email)}`;
export const raceHref = (id: string) => `/admin?tab=races&race=${encodeURIComponent(id)}`;

/** What every panel needs to name runners and races. */
export interface AdminData {
  races: RaceCard[];
  runners: Runner[];
  comments: AdminComment[];
  reactionsGiven: Record<string, number>;
}

const raceOf = (data: AdminData, id: string | null) => data.races.find((r) => r.id === id);
const raceName = (data: AdminData, id: string) => {
  const r = raceOf(data, id);
  return r ? `${r.event}, ${r.category}` : `${id} (deleted)`;
};
const nameOf = (data: AdminData, email: string) => data.runners.find((r) => r.email === email)?.name || email;
const reactionText = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([emoji, n]) => `${emoji} ${n}`)
    .join("  ");

/** The activity log as a feed, newest first. */
export function ActivityFeed({ events, data, label }: { events: ActivityEvent[] | null; data: AdminData; label: string }) {
  if (!events) return <p className={styles.muted}>The activity log needs the database (DATABASE_URL).</p>;
  if (events.length === 0) return <p className={styles.muted}>Nothing logged yet. Sign-ins, goals, comments, reactions and race changes show here as they happen.</p>;
  const items: TimelineEvent[] = events.map((e) => ({
    id: e.id,
    at: e.at,
    actor: nameOf(data, e.email),
    title: `${EVENT_KINDS[e.kind] ?? e.kind}${e.raceId ? ` on ${raceName(data, e.raceId)}` : ""}`,
    meta: e.detail || undefined,
    tone: e.kind.endsWith("deleted") ? "danger" : undefined,
  }));
  // eslint-disable-next-line react-hooks/purity -- a server render; the time only labels "x minutes ago".
  return <Timeline events={items} now={Date.now()} label={label} timeZone={TZ} locale="en-GB" maxHeight={480} />;
}

/** Comments with their race, author, reactions and a delete button. */
function CommentList({ comments, data, show }: { comments: AdminComment[]; data: AdminData; show: "race" | "runner" }) {
  if (comments.length === 0) return <p className={styles.muted}>No comments.</p>;
  return (
    <ul className={styles.raceList}>
      {comments.map((c) => (
        <li key={c.id} className={styles.logRow}>
          <div className={styles.raceText}>
            <span className={styles.raceMeta}>
              {show === "race" ? (
                <Link href={raceHref(c.raceId)}>{raceName(data, c.raceId)}</Link>
              ) : (
                <Link href={runnerHref(c.email)}>{c.name || c.email}</Link>
              )}
              , {dayTime.format(new Date(c.createdAt))}
              {Object.keys(c.counts).length ? `. ${reactionText(c.counts)}` : ""}
            </span>
            <span className={styles.commentBody}>{c.body}</span>
          </div>
          <div className={styles.rowActions}>
            <DeleteComment raceId={c.raceId} id={c.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className={styles.facts}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const goalText = (g: SavedGoal, km?: number) =>
  `${formatClock(g.goalSeconds)}${km ? ` (${formatPace(g.goalSeconds / km)}/km)` : ""}, start ${g.startTime}, saved ${day.format(new Date(g.savedAt))}`;

/** One runner: profile, goals, races, comments and everything they did. */
export function RunnerPanel({ runner, data, events }: { runner: Runner; data: AdminData; events: ActivityEvent[] | null }) {
  const p = runner.profile;
  const profile = p && [p.age && `${p.age} years`, p.sex, p.heightCm && `${p.heightCm} cm`, p.weightKg && `${p.weightKg} kg`, p.vo2max && `VO2 max ${p.vo2max}`].filter(Boolean).join(", ");
  const goals = Object.entries(runner.goals).sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt));
  const races = data.races.filter((r) => r.owner?.toLowerCase() === runner.email);
  const comments = data.comments.filter((c) => c.email === runner.email);
  const received = comments.reduce((n, c) => n + Object.values(c.counts).reduce((a, b) => a + b, 0), 0);
  return (
    <section className={styles.panel} aria-labelledby="runner-heading" id="runner">
      <div className={styles.panelHead}>
        <span className={styles.who}>
          <Avatar name={runner.name || runner.email} size="lg" />
          <h2 id="runner-heading" className={styles.h2}>
            {runner.name || runner.email}
          </h2>
        </span>
        <Link href="/admin?tab=runners" className={styles.ghostLink}>
          Close
        </Link>
      </div>
      <Facts
        rows={[
          ["Email", <a key="e" href={`mailto:${runner.email}`}>{runner.email}</a>],
          ["Signed up", dayTime.format(new Date(runner.signedUpAt))],
          ["Last sign-in", dayTime.format(new Date(runner.lastSignInAt))],
          ["Profile", profile || "Not saved"],
          ["Engagement", `${goals.length} goals, ${races.length} races added, ${comments.length} comments, ${received} reactions received, ${data.reactionsGiven[runner.email] ?? 0} given`],
        ]}
      />
      <h3 className={styles.h3}>Goals</h3>
      {goals.length ? (
        <ul className={styles.plainList}>
          {goals.map(([id, g]) => (
            <li key={id}>
              <Link href={raceHref(id)}>{raceName(data, id)}</Link>: {goalText(g, raceOf(data, id)?.km)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No goals saved.</p>
      )}
      <h3 className={styles.h3}>Races added</h3>
      {races.length ? (
        <ul className={styles.plainList}>
          {races.map((r) => (
            <li key={r.id}>
              <Link href={raceHref(r.id)}>
                {r.event}, {r.category}
              </Link>
              : {r.private ? "private" : `published as ${r.publishedBy}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No races added.</p>
      )}
      <h3 className={styles.h3}>Comments</h3>
      <CommentList comments={comments} data={data} show="race" />
      <h3 className={styles.h3}>Activity</h3>
      <ActivityFeed events={events} data={data} label={`Activity of ${runner.name || runner.email}`} />
    </section>
  );
}

/** One race: details, who published it, runners' goals, comments and its log. */
export function RacePanel({ race, stored, data, events }: { race: RaceCard; stored: StoredRace | null; data: AdminData; events: ActivityEvent[] | null }) {
  const goals = data.runners
    .filter((r) => r.goals[race.id])
    .map((r) => ({ runner: r, goal: r.goals[race.id] }))
    .sort((a, b) => a.goal.goalSeconds - b.goal.goalSeconds);
  const comments = data.comments.filter((c) => c.raceId === race.id);
  const reactions = comments.reduce((n, c) => n + Object.values(c.counts).reduce((a, b) => a + b, 0), 0);
  const source = race.builtIn ? "Built in" : race.owner ? (
    <>
      Added by <Link href={runnerHref(race.owner.toLowerCase())}>{nameOf(data, race.owner.toLowerCase())}</Link>
    </>
  ) : (
    "Added by the admin"
  );
  return (
    <section className={styles.panel} aria-labelledby="race-heading" id="race">
      <div className={styles.panelHead}>
        <h2 id="race-heading" className={styles.h2}>
          {race.event}, {race.category}
        </h2>
        <Link href="/admin" className={styles.ghostLink}>
          Close
        </Link>
      </div>
      <Facts
        rows={[
          ["Date", `${race.dateLabel}${race.startTime ? `, start ${race.startTime}` : ""}`],
          ["Where", race.location],
          ["Distance", `${race.km} km, ${race.gainM} m climb, ${race.drinkStops} drink stops`],
          ["Source", source],
          [
            "Visibility",
            race.private
              ? "Private to its runner"
              : stored?.publishedAt
                ? `Published by ${stored.publishedBy} on ${dayTime.format(new Date(stored.publishedAt))}`
                : "Public",
          ],
          ...(stored ? [["Last changed", dayTime.format(new Date(stored.updatedAt))] as [string, string]] : []),
          ["Links", <span key="l" className={styles.linkRow}><Link href={`/races/${race.id}`}>Race page</Link>{race.officialUrl ? <a href={race.officialUrl}>Official site</a> : null}{race.files.map((f) => <a key={f.href} href={f.href}>{f.label}</a>)}</span>],
          ["Engagement", `${goals.length} runners set a goal, ${comments.length} comments, ${reactions} reactions`],
        ]}
      />
      <h3 className={styles.h3}>Runners&apos; goals</h3>
      {goals.length ? (
        <ul className={styles.plainList}>
          {goals.map(({ runner, goal }) => (
            <li key={runner.email}>
              <Link href={runnerHref(runner.email)}>{runner.name || runner.email}</Link>: {goalText(goal, race.km)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No runner has saved a goal for this race.</p>
      )}
      <h3 className={styles.h3}>Comments</h3>
      <CommentList comments={comments} data={data} show="runner" />
      <h3 className={styles.h3}>Log</h3>
      <ActivityFeed events={events} data={data} label={`Log of ${race.event}`} />
    </section>
  );
}
