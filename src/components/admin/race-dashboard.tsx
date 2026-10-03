import Link from "next/link";
import type { ReactNode } from "react";
import { ImagePlus, Pencil, Plus } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { ExpandableCard } from "@/components/arc/expandable-card/expandable-card";
import { VisibilityBadge, visibilityOf } from "@/components/site/visibility-badge";
import { DeleteRace } from "./delete-race";
import { eventKey } from "@/lib/server/races";
import { PublishRace } from "./publish-race";
import { PublishedToast } from "./published-toast";
import styles from "./admin.module.css";

interface Row {
  id: string;
  event: string;
  category: string;
  dateLabel: string;
  /** "YYYY-MM-DD" */
  date?: string;
  km: number;
  coverUrl?: string;
  builtIn: boolean;
  owner?: string;
  publishedBy?: string;
  bib?: string;
}

export interface RaceStats {
  goals: number;
  comments: number;
  reactions: number;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** One line under an event's name: distances, days and, for the admin, engagement. */
function summary(list: Row[], stats?: Record<string, RaceStats>, likes = 0): string {
  const days = list.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  const when = days.length ? shortDate.formatRange(new Date(days[0]), new Date(days[days.length - 1])) : list[0].dateLabel;
  const hidden = list.filter((r) => visibilityOf(r) === "private").length;
  let text = `${plural(list.length, "distance")}, ${when}${hidden ? `, ${hidden} private` : ""}`;
  if (stats) {
    const sum = (k: keyof RaceStats) => list.reduce((n, r) => n + (stats[r.id]?.[k] ?? 0), 0);
    text += `. ${plural(likes, "like")}, ${plural(sum("goals"), "goal")}, ${plural(sum("comments"), "comment")}`;
  }
  return text;
}

/** The race list in /admin (every race) and /my (a runner's own races): a card per event that opens to its distances. */
export function RaceDashboard({
  title,
  lede,
  base,
  races,
  saved,
  storage,
  empty,
  stats,
  published,
  likes,
  children,
}: {
  title: string;
  lede: string;
  /** "/admin" or "/my": new and edit pages live under base/races. */
  base: string;
  races: Row[];
  saved: boolean;
  storage: { ok: true } | { ok: false; error: string };
  empty?: string;
  /** Admin only: engagement per race id. Adds it to each row with a link to the race's details. */
  stats?: Record<string, RaceStats>;
  /** Id of a race that was just published, to confirm it with a toast. */
  published?: string;
  /** Admin only: likes per event key. */
  likes?: Record<string, number>;
  /** Shown under the heading, above the race list. */
  children?: ReactNode;
}) {
  const groups = new Map<string, Row[]>();
  for (const r of races) {
    const key = eventKey({ ...r, private: Boolean(r.owner) && !r.publishedBy });
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const justPublished = published ? races.find((r) => r.id === published) : undefined;
  const events = [...groups.entries()].map(([key, list]) => ({ key, list: list.sort((a, b) => a.km - b.km) }));
  return (
    <>
      <section className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{lede}</p>
        </div>
        <Link href={`${base}/races/new`} className={styles.primaryLink}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New race
        </Link>
      </section>

      {saved ? (
        <Alert tone="success" title="Saved">
          The overview shows the latest details now.
        </Alert>
      ) : null}

      {!storage.ok ? (
        <Alert tone="danger" title="File storage is not working">
          {storage.error} New races and covers cannot be saved until this is fixed. After changing environment variables in
          Vercel, redeploy.
        </Alert>
      ) : null}

      {children}

      {justPublished ? <PublishedToast name={`${justPublished.event}, ${justPublished.category}`} /> : null}

      {races.length === 0 && empty ? <p className={styles.notice}>{empty}</p> : null}

      <ul className={styles.eventCards} aria-label="Races" hidden={races.length === 0}>
        {events.map(({ key, list }) => {
          const cover = list.find((r) => r.coverUrl)?.coverUrl;
          return (
            <li key={list[0].id}>
              <ExpandableCard title={list[0].event} description={summary(list, stats, likes?.[key])}>
                <div className={styles.eventDetail}>
                  <div className={styles.thumb}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" />
                    ) : (
                      <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </div>
                  <ul className={styles.distanceList} aria-label={`Distances of ${list[0].event}`}>
                    {list.map((r) => {
                      const s = stats?.[r.id];
                      return (
                        <li key={r.id} className={styles.distanceRow}>
                          <div className={styles.raceText}>
                            <span className={styles.distanceHead}>
                              <Link href={`/races/${r.id}`} className={styles.distanceName}>
                                {r.category}
                              </Link>
                              <VisibilityBadge visibility={visibilityOf(r)} />
                            </span>
                            <span className={styles.raceMeta}>
                              {r.dateLabel}
                              {r.builtIn ? ", built in" : ""}
                              {r.owner && base === "/admin" ? `, added by ${r.owner}` : ""}
                              {r.publishedBy ? `, published by ${r.publishedBy}` : ""}
                              {r.bib && base === "/my" ? `, bib ${r.bib}` : ""}
                              {s ? `. ${plural(s.goals, "goal")}, ${plural(s.comments, "comment")}, ${plural(s.reactions, "reaction")}` : ""}
                            </span>
                          </div>
                          <div className={styles.rowActions}>
                            {stats ? (
                              <Link href={`/admin?tab=races&race=${encodeURIComponent(r.id)}`} className={styles.ghostLink}>
                                Details
                              </Link>
                            ) : null}
                            <Link href={`${base}/races/${r.id}`} className={styles.ghostLink}>
                              {r.builtIn ? <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />}
                              {r.builtIn ? "Cover" : "Edit"}
                            </Link>
                            {r.owner ? <PublishRace id={r.id} published={Boolean(r.publishedBy)} /> : null}
                            {r.builtIn ? null : <DeleteRace id={r.id} name={`${r.event}, ${r.category}`} />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </ExpandableCard>
            </li>
          );
        })}
      </ul>
    </>
  );
}
