import Link from "next/link";
import { ArrowRight, ExternalLink, FileDown, Plus } from "lucide-react";
import { RoutePreview } from "@/components/site/route-preview";
import { SiteHeader } from "@/components/site/site-header";
import { shortDistance } from "@/lib/courses/distance";
import type { RaceEvent } from "@/lib/server/races";
import styles from "./overview.module.css";

function startLabel(hhmm?: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"} start`;
}

/** The home page: one card per event, with a ribbon for each distance. Opening a card shows its race plan. */
export function Overview({ events, signedIn }: { events: RaceEvent[]; signedIn: boolean }) {
  return (
    <main className={styles.page}>
      <SiteHeader />

      <section className={styles.intro} aria-labelledby="races-heading">
        <h1 id="races-heading" className={styles.title}>
          Your races
        </h1>
        <p className={styles.lede}>
          Pick the race you are running to open its plan: pace for every kilometre, hills, gels and water, heart rate zones and a
          full rehearsal of the course.
        </p>
      </section>

      <ul className={styles.grid} aria-label="Races">
        {events.map((e) => {
          const r = e.main;
          const single = e.races.length === 1;
          return (
            <li key={e.key} className={styles.card}>
              <Link href={`/races/${r.id}`} className={styles.cardMain}>
                {r.coverUrl ? (
                  <div className={styles.coverWrap}>
                    {/* Covers come from R2 or /api/files, so a plain img avoids image optimizer host config. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.coverUrl} alt="" className={styles.cover} loading="lazy" decoding="async" />
                    <span className={styles.routeInset} aria-hidden="true">
                      <RoutePreview {...r.preview} width={320} height={180} className={styles.previewSvg} />
                    </span>
                  </div>
                ) : (
                  <div className={styles.preview}>
                    <RoutePreview {...r.preview} width={320} height={180} className={styles.previewSvg} />
                  </div>
                )}
                <div className={styles.cardBody}>
                  <p className={styles.date}>
                    {e.dateLabel}
                    {e.private ? ", only you can see this" : ""}
                  </p>
                  <h2 className={styles.cardTitle}>{e.event}</h2>
                  <p className={styles.meta}>
                    {single ? `${r.category}, ` : ""}
                    {e.location}
                    {single && startLabel(r.startTime) ? `, ${startLabel(r.startTime)}` : ""}
                  </p>
                  <span className={styles.open}>
                    Open race plan
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </div>
              </Link>
              <ul className={styles.ribbons} aria-label={`${e.event} distances`}>
                {e.races.map((d) => (
                  <li key={d.id}>
                    <Link href={`/races/${d.id}`} className={styles.ribbon} title={d.category}>
                      {shortDistance(d.km)}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className={styles.links} aria-label={`${e.event} links and files`}>
                <li>
                  <a href={e.officialUrl} target="_blank" rel="noreferrer" className={styles.link}>
                    <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                    Official website
                  </a>
                </li>
                {single
                  ? r.files.map((f) => (
                      <li key={f.href}>
                        <a href={f.href} download className={styles.link}>
                          <FileDown size={16} strokeWidth={1.75} aria-hidden="true" />
                          {f.label}
                        </a>
                      </li>
                    ))
                  : null}
              </ul>
            </li>
          );
        })}

        <li className={`${styles.card} ${styles.addCard}`}>
          <Link href={signedIn ? "/my/races/new" : "/signin?next=/my/races/new"} className={styles.addMain}>
            <Plus size={24} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.cardTitle}>Add your race</span>
            <span className={styles.meta}>
              Upload the course GPX, route map and race documents. {signedIn ? "Only you can see it." : "Sign in with Google first."}
            </span>
          </Link>
        </li>
      </ul>

      <footer className={styles.footer}>
        General guidance, not medical or coaching advice. Practise your pacing and fuel in training before race day.
      </footer>
    </main>
  );
}
