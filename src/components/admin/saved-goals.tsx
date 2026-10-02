import Link from "next/link";
import { Flag } from "lucide-react";
import { clockAt } from "@/components/planner/util";
import { formatClock, formatPace, type SavedGoal } from "@/lib/planner";
import type { RaceCard } from "@/lib/server/races";
import styles from "./admin.module.css";

const savedOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

/** The goals a runner saved on race pages, each linking back to its plan. */
export function SavedGoals({ goals }: { goals: { race: RaceCard; goal: SavedGoal }[] }) {
  return (
    <section aria-labelledby="goals-heading">
      <h2 id="goals-heading" className={styles.h2}>
        Saved goals
      </h2>
      {goals.length === 0 ? (
        <p className={styles.muted}>
          None yet. Open a race, set your goal finish time and choose Save my goal. It will show here.
        </p>
      ) : (
        <ul className={styles.raceList}>
          {goals.map(({ race, goal }) => (
            <li key={race.id} className={styles.raceRow}>
              <div className={styles.thumb}>
                {race.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={race.coverUrl} alt="" />
                ) : (
                  <Flag size={20} strokeWidth={1.75} aria-hidden="true" />
                )}
              </div>
              <div className={styles.raceText}>
                <Link href={`/races/${race.id}`} className={styles.raceName}>
                  {race.event}
                </Link>
                <span className={styles.raceMeta}>
                  {race.category}, {race.dateLabel}. Goal <span className={styles.num}>{formatClock(goal.goalSeconds)}</span> (
                  {formatPace(goal.goalSeconds / race.km)}/km), start {clockAt(goal.startTime, 0)}. Saved {savedOn.format(new Date(goal.savedAt))}.
                </span>
              </div>
              <div className={styles.rowActions}>
                <Link href={`/races/${race.id}`} className={styles.ghostLink}>
                  Open plan
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
