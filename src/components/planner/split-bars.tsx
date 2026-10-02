"use client";

import { useState } from "react";
import { formatPace, type Plan } from "@/lib/planner";
import styles from "./planner.module.css";

/** Strava-style pace bars, one row per kilometre: the longer the bar, the faster the kilometre. */
export function SplitBars({ plan }: { plan: Plan }) {
  const [hover, setHover] = useState<{ i: number; top: number } | null>(null);
  const avg = plan.summary.goalPaceSecPerKm;
  const splits = plan.splits;
  const deltas = splits.map((s) => avg - s.paceSecPerKm);
  // Bars start a minute per km slower than the slowest km, so even the slowest bar has length and a few seconds still show.
  const floor = Math.max(...splits.map((s) => s.paceSecPerKm)) + 60;
  const fastestPace = Math.min(...splits.map((s) => s.paceSecPerKm));
  const fastest = deltas.indexOf(Math.max(...deltas));
  const slowest = deltas.indexOf(Math.min(...deltas));
  const name = (i: number) => (i === splits.length - 1 && splits[i].lengthKm < 1 ? "Finish" : `Km ${splits[i].km}`);

  const vsAvg = (i: number) => {
    const d = Math.round(deltas[i]);
    return d === 0 ? "On average pace" : `${Math.abs(d)} s ${d > 0 ? "faster" : "slower"} than average`;
  };

  return (
    <figure className={`${styles.chart} ${styles.splitChart}`}>
      <figcaption className={styles.chartHead}>
        <span className={styles.h3}>Pace per km</span>
        <span className={`${styles.chartValue} ${styles.num}`}>
          Fastest: {name(fastest)} at {formatPace(splits[fastest].paceSecPerKm)}. Slowest: {name(slowest)} at{" "}
          {formatPace(splits[slowest].paceSecPerKm)}.
        </span>
      </figcaption>
      <div className={styles.splitBars} onPointerLeave={() => setHover(null)}>
        <div className={`${styles.splitRow} ${styles.splitAxis}`} aria-hidden="true">
          <span>Km</span>
          <span>Pace</span>
          <span />
          <span>Elev</span>
        </div>
        <ol className={styles.splitList} aria-label="Pace per kilometre">
          {splits.map((s, i) => {
            const w = ((floor - s.paceSecPerKm) / (floor - fastestPace)) * 100;
            const elev = Math.round(s.avgGrade * s.lengthKm * 10);
            return (
              <li
                key={s.km}
                className={styles.splitRow}
                data-active={hover?.i === i || undefined}
                onPointerEnter={(e) => setHover({ i, top: e.currentTarget.offsetTop })}
              >
                <span className={styles.num}>{name(i) === "Finish" ? "Fin" : s.km}</span>
                <span className={styles.num}>{formatPace(s.paceSecPerKm)}</span>
                <span className={styles.splitTrack}>
                  <span className={styles.splitFill} style={{ width: `${w}%` }} />
                </span>
                <span className={`${styles.num} ${styles.muted}`}>{elev > 0 ? `+${elev}` : elev < 0 ? `\u2212${-elev}` : 0} m</span>
              </li>
            );
          })}
        </ol>
        {hover ? (
          <div className={`${styles.tooltip} ${styles.splitTip}`} style={{ top: hover.top + 28 }} aria-hidden="true">
            <span className={styles.num}>
              {name(hover.i)}, {formatPace(splits[hover.i].paceSecPerKm)}/km
            </span>
            <span>{vsAvg(hover.i)}</span>
            {splits[hover.i].events.length ? <span>{splits[hover.i].events.map((e) => e.title).join(", ")}</span> : null}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
