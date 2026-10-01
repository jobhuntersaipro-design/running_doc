"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { formatClock, formatPace, type Plan } from "@/lib/planner";
import { clockAt } from "./util";
import styles from "./planner.module.css";

const MARK: Record<string, string> = { gel: "Gel", drink: "Water" };

export function PaceBand({ plan, startTime }: { plan: Plan; startTime: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.sectionHead}>
        <p className={styles.muted}>
          Print it, cut it out and tape it around your wrist or a gel. Check the race time at each marker.
        </p>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
          Print pace band
        </Button>
      </div>

      <div className={`pace-band-print ${styles.band}`}>
        <p className={styles.bandTitle}>
          {plan.name}: {formatClock(plan.summary.goalSeconds)} at {formatPace(plan.summary.goalPaceSecPerKm)}/km
        </p>
        <table className={styles.bandTable}>
          <thead>
            <tr>
              <th scope="col">Km</th>
              <th scope="col">Time</th>
              <th scope="col">Clock</th>
              <th scope="col">Pace</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {plan.splits.map((s) => {
              const marks = [
                ...(s.avgGrade >= 1.2 ? ["Hill"] : []),
                ...new Set(s.events.map((e) => MARK[e.type]).filter(Boolean)),
              ].join(", ");
              const isFinish = s.lengthKm < 1;
              return (
                <tr key={s.km}>
                  <td>{isFinish ? "Fin" : s.km}</td>
                  <td>{formatClock(s.cumulativeSeconds)}</td>
                  <td>{clockAt(startTime, s.cumulativeSeconds)}</td>
                  <td>{isFinish ? "" : formatPace(s.paceSecPerKm)}</td>
                  <td>{marks}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
