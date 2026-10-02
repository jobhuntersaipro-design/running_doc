import Link from "next/link";
import { ArrowRight, ExternalLink, FileDown, Plus } from "lucide-react";
import { RoutePreview } from "@/components/site/route-preview";
import { SiteHeader } from "@/components/site/site-header";
import type { RaceCard } from "@/lib/server/races";
import styles from "./overview.module.css";

export type RaceCardData = Pick<
  RaceCard,
  "id" | "event" | "category" | "dateLabel" | "location" | "startTime" | "officialUrl" | "files" | "km" | "gainM" | "drinkStops" | "preview" | "coverUrl" | "private"
>;

/** Overview tabs. A race lands in the tab whose distance is nearest its own (a 15K sits only under All). */
export const DISTANCE_TABS = [
  { value: "all", label: "All", min: 0, max: Infinity },
  { value: "5k", label: "5K", min: 4, max: 6 },
  { value: "10k", label: "10K", min: 8, max: 12 },
  { value: "half", label: "Half marathon", min: 19, max: 23 },
  { value: "full", label: "Marathon", min: 40, max: 45 },
] as const;
export type DistanceTab = (typeof DISTANCE_TABS)[number]["value"];

const inTab = (km: number, tab: DistanceTab) => {
  const t = DISTANCE_TABS.find((d) => d.value === tab)!;
  return km >= t.min && km <= t.max;
};

function startLabel(hhmm?: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"} start`;
}

/** The home page: one card per race. Opening a card shows its full race plan. */
export function Overview({ races: all, signedIn, tab }: { races: RaceCardData[]; signedIn: boolean; tab: DistanceTab }) {
  const races = all.filter((r) => inTab(r.km, tab));
  const tabLabel = DISTANCE_TABS.find((t) => t.value === tab)!.label;
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

      <nav className={styles.tabs} aria-label="Race distance">
        {DISTANCE_TABS.map((t) => {
          const count = all.filter((r) => inTab(r.km, t.value)).length;
          return (
            <Link
              key={t.value}
              href={t.value === "all" ? "/" : `/?distance=${t.value}`}
              className={styles.tab}
              aria-current={t.value === tab ? "page" : undefined}
              scroll={false}
            >
              {t.label}
              <span className={styles.tabCount}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {races.length === 0 ? (
        <p className={styles.emptyTab}>No {tabLabel.toLowerCase()} races yet. Add yours below to get a full plan for it.</p>
      ) : null}

      <ul className={styles.grid} aria-label={tab === "all" ? "Races" : `${tabLabel} races`}>
        {races.map((r) => (
          <li key={r.id} className={styles.card}>
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
                  {r.dateLabel}
                  {r.private ? ", only you can see this" : ""}
                </p>
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
