import Link from "next/link";
import { ArrowRight, ExternalLink, FileDown, Plus } from "lucide-react";
import { RoutePreview } from "@/components/site/route-preview";
import { SiteHeader } from "@/components/site/site-header";
import type { RaceCard } from "@/lib/server/races";
import styles from "./overview.module.css";

export type RaceCardData = Pick<
  RaceCard,
  "id" | "event" | "category" | "dateLabel" | "location" | "startTime" | "officialUrl" | "files" | "km" | "gainM" | "drinkStops" | "preview" | "coverUrl"
>;

function startLabel(hhmm?: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"} start`;
}

/** The home page: one card per race. Opening a card shows its full race plan. */
export function Overview({ races }: { races: RaceCardData[] }) {
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
        {races.map((r) => (
          <li key={r.id} className={styles.card}>
            <Link href={`/races/${r.id}`} className={styles.cardMain}>
              {r.coverUrl ? (
                <div className={styles.coverWrap}>
                  {/* Covers come from Blob or /api/files, so a plain img avoids image optimizer host config. */}
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
                <p className={styles.date}>{r.dateLabel}</p>
                <h2 className={styles.cardTitle}>{r.event}</h2>
                <p className={styles.meta}>
                  {r.category}, {r.location}
                  {startLabel(r.startTime) ? `, ${startLabel(r.startTime)}` : ""}
                </p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Distance</dt>
                    <dd>{r.km.toFixed(1)} km</dd>
                  </div>
                  <div>
                    <dt>Total uphill</dt>
                    <dd>{r.gainM} m</dd>
                  </div>
                  <div>
                    <dt>Drink stops</dt>
                    <dd>{r.drinkStops}</dd>
                  </div>
                </dl>
                <span className={styles.open}>
                  Open race plan
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </div>
            </Link>
            <ul className={styles.links} aria-label={`${r.event} links and files`}>
              <li>
                <a href={r.officialUrl} target="_blank" rel="noreferrer" className={styles.link}>
                  <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                  Official website
                </a>
              </li>
              {r.files.map((f) => (
                <li key={f.href}>
                  <a href={f.href} download className={styles.link}>
                    <FileDown size={16} strokeWidth={1.75} aria-hidden="true" />
                    {f.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}

        <li className={`${styles.card} ${styles.addCard}`}>
          <Link href="/races/custom" className={styles.addMain}>
            <Plus size={24} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.cardTitle}>Plan another race</span>
            <span className={styles.meta}>Upload the course GPX from any race and add its aid stations.</span>
          </Link>
        </li>
      </ul>

      <footer className={styles.footer}>
        General guidance, not medical or coaching advice. Practise your pacing and fuel in training before race day.
      </footer>
    </main>
  );
}
