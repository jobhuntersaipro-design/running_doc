import Link from "next/link";
import type { ReactNode } from "react";
import { ImagePlus, Pencil, Plus } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { DeleteRace } from "./delete-race";
import { PublishRace } from "./publish-race";
import styles from "./admin.module.css";

interface Row {
  id: string;
  event: string;
  category: string;
  dateLabel: string;
  coverUrl?: string;
  builtIn: boolean;
  owner?: string;
  publishedBy?: string;
  bib?: string;
}

/** The race list in /admin (every race) and /my (a runner's own races). */
export function RaceDashboard({
  title,
  lede,
  base,
  races,
  saved,
  storage,
  empty,
  stats,
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
  stats?: Record<string, string>;
  /** Shown under the heading, above the race list. */
  children?: ReactNode;
}) {
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

      {races.length === 0 && empty ? <p className={styles.notice}>{empty}</p> : null}

      <ul className={styles.raceList} aria-label="Races" hidden={races.length === 0}>
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
                {r.owner && base === "/admin" ? `, added by ${r.owner}` : ""}
                {r.publishedBy ? `, published by ${r.publishedBy}` : r.owner ? ", private" : ""}
                {r.bib && base === "/my" ? `, bib ${r.bib}` : ""}
                {stats?.[r.id] ? `. ${stats[r.id]}` : ""}
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
              {r.builtIn ? null : <DeleteRace id={r.id} name={r.event} />}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
