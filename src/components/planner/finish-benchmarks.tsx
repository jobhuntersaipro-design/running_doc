"use client";

import { useState } from "react";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { FINISH_SPREAD, benchmarkFor, finishDensity, finishMode, formatClock, shareSlowerThan, type FinishBenchmark } from "@/lib/planner";
import styles from "./planner.module.css";

function gap(goal: number, other: number): string {
  const d = Math.round(Math.abs(goal - other));
  // 1:57 or 14:34 under an hour, h:mm:ss above it.
  const text = d >= 3600 ? formatClock(d) : `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
  return goal <= other ? `${text} faster than` : `${text} slower than`;
}

/** Where the goal sits against average finishers at big events. */
export function FinishBenchmarks({ km, goalSeconds }: { km: number; goalSeconds: number }) {
  const b = benchmarkFor(km);
  if (!b) return null;
  const marks = [
    { key: "goal", label: "Your goal", seconds: goalSeconds },
    { key: "men", label: "Average man", seconds: b.menSeconds },
    { key: "women", label: "Average woman", seconds: b.womenSeconds },
  ];
  const lo = Math.min(...marks.map((m) => m.seconds)) * 0.9;
  const hi = Math.max(...marks.map((m) => m.seconds)) * 1.08;
  const pos = (s: number) => `${((s - lo) / (hi - lo)) * 100}%`;

  return (
    <section className={styles.benchmarks} aria-labelledby="benchmarks-heading">
      <div className={styles.sectionHead}>
        <h3 id="benchmarks-heading" className={styles.h3}>
          Average {b.distance} finish times
        </h3>
        <a className={styles.sourceLink} href={b.source.url} target="_blank" rel="noreferrer">
          Source: {b.source.name}
        </a>
      </div>
      <dl className={styles.benchStats}>
        {marks.map((m) => (
          <div key={m.key} data-goal={m.key === "goal" ? "" : undefined}>
            <dt>{m.label}</dt>
            <dd className={styles.num}>{formatClock(m.seconds)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.benchScale} aria-hidden="true">
        <span className={styles.benchTrack} />
        {marks.map((m) => (
          <span key={m.key} className={styles.benchMark} data-kind={m.key} style={{ left: pos(m.seconds) }}>
            <span className={styles.benchDot} data-kind={m.key} />
            <span className={styles.benchLabel}>{m.key === "goal" ? "You" : m.key === "men" ? "Men" : "Women"}</span>
          </span>
        ))}
      </div>
      <p className={styles.muted}>
        Your goal is {gap(goalSeconds, b.menSeconds)} the average man and {gap(goalSeconds, b.womenSeconds)} the average woman.
        These averages come from big-event results, not this race. Hot, humid or hilly races are usually slower.
      </p>
      <Distribution b={b} goalSeconds={goalSeconds} />
    </section>
  );
}

/** Round-minute ticks across the time range, three to five of them. */
function ticks(lo: number, hi: number): number[] {
  const step = [60, 120, 300, 600, 900, 1800, 3600].find((s) => (hi - lo) / s <= 6) ?? 3600;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

const minutes = (s: number) => (s >= 3600 ? formatClock(s).replace(/:\d\d$/, "") : `${Math.round(s / 60)} min`);

/** Plot height in px; the curves use the lower CURVE_H, leaving room above for labels. */
const PLOT_H = 210;
const CURVE_H = 150;

/** An SVG path tracing the density curve from x0 to x1, closed to the baseline when `area` is set. */
function curve(mean: number, x0: number, x1: number, peak: number, area: boolean): string {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = x0 + ((x1 - x0) * i) / 120;
    pts.push(`${((i / 120) * 1000).toFixed(1)},${(PLOT_H - (finishDensity(t, mean) / peak) * CURVE_H).toFixed(1)}`);
  }
  return `M${pts.join("L")}${area ? `L1000,${PLOT_H}L0,${PLOT_H}Z` : ""}`;
}

/**
 * How finish times spread for men and women in an age group, with the goal
 * marked and the share of each group it beats.
 */
function Distribution({ b, goalSeconds }: { b: FinishBenchmark; goalSeconds: number }) {
  const [group, setGroup] = useState("all");
  const row = b.ages.find((a) => a.group === group);
  const men = row?.menSeconds ?? b.menSeconds;
  const women = row?.womenSeconds ?? b.womenSeconds;
  const x0 = Math.min(men, women, goalSeconds) * 0.55;
  const x1 = Math.max(men, women, goalSeconds) * 1.65;
  // Both curves share one height scale, so the taller one is the narrower spread.
  const peak = Math.max(finishDensity(men * 0.96, men), finishDensity(women * 0.96, women)) * 1.05;
  const pos = (s: number) => `${((s - x0) / (x1 - x0)) * 100}%`;
  const pct = (mean: number) => Math.round(shareSlowerThan(goalSeconds, mean) * 100);
  const who = row ? `aged ${row.group}` : "of all ages";

  return (
    <figure className={styles.ageChart}>
      <div className={styles.sectionHead}>
        <figcaption className={styles.h3}>Finish-time distribution</figcaption>
        <a className={styles.sourceLink} href={(row ? b.agesSource : b.source).url} target="_blank" rel="noreferrer">
          Averages: {(row ? b.agesSource : b.source).name}
        </a>
      </div>
      <ChipGroup
        label="Age group"
        multiple={false}
        options={[{ value: "all", label: "All ages" }, ...b.ages.map((a) => ({ value: a.group, label: a.group }))]}
        value={[group]}
        onValueChange={(v) => setGroup(v[0] ?? "all")}
      />
      <ul className={styles.ageLegend} aria-hidden="true">
        <li>
          <span className={styles.distKey} data-kind="men" /> Men, average {formatClock(men)}
        </li>
        <li>
          <span className={styles.distKey} data-kind="women" /> Women, average {formatClock(women)}
        </li>
        <li>
          <span className={styles.ageGoalKey} /> Your goal, {formatClock(goalSeconds)}
        </li>
      </ul>

      <div className={styles.distPlot} aria-hidden="true">
        <svg viewBox={`0 0 1000 ${PLOT_H}`} preserveAspectRatio="none" style={{ height: PLOT_H }}>
          <path d={curve(women, x0, x1, peak, true)} className={styles.distArea} data-kind="women" />
          <path d={curve(men, x0, x1, peak, true)} className={styles.distArea} data-kind="men" />
          <path d={curve(women, x0, x1, peak, false)} className={styles.distLine} data-kind="women" />
          <path d={curve(men, x0, x1, peak, false)} className={styles.distLine} data-kind="men" />
        </svg>
        <span className={styles.distGoal} style={{ left: pos(goalSeconds), height: PLOT_H }} />
        <span className={styles.distGoalLabel} style={{ left: pos(goalSeconds) }} data-side={goalSeconds > (x0 + x1) / 2 ? "left" : "right"}>
          You, {formatClock(goalSeconds)}
        </span>
        {(
          [
            ["men", "Men", men, 24],
            ["women", "Women", women, 46],
          ] as const
        ).map(([kind, name, mean, top]) => (
          // Each label gets its own row above the curves, centred on its peak but kept inside the chart.
          <span
            key={kind}
            className={styles.distPeakLabel}
            data-kind={kind}
            style={{ left: `${Math.min(88, Math.max(12, ((finishMode(mean) - x0) / (x1 - x0)) * 100))}%`, top }}
          >
            {name}, avg {formatClock(mean)}
          </span>
        ))}
        <div className={styles.distAxis} style={{ top: PLOT_H }}>
          {ticks(x0, x1).map((v) => (
            <span key={v} className={styles.ageTick} style={{ left: pos(v) }}>
              {minutes(v)}
            </span>
          ))}
        </div>
      </div>

      <p className={styles.distResult}>
        Your goal beats about <span className={styles.num}>{pct(men)}%</span> of men and{" "}
        <span className={styles.num}>{pct(women)}%</span> of women {who}.
      </p>

      {/* The wrapper clips the table: a table box ignores width: 1px and would widen the page on phones. */}
      <div className={styles.srOnly}>
        <table>
          <caption>Average {b.distance} finish time and the share your goal beats, by age group</caption>
          <thead>
            <tr>
              <th scope="col">Age</th>
              <th scope="col">Men</th>
              <th scope="col">Women</th>
            </tr>
          </thead>
          <tbody>
            {b.ages.map((a) => (
              <tr key={a.group}>
                <th scope="row">{a.group}</th>
                <td>
                  {formatClock(a.menSeconds)}, goal beats {pct(a.menSeconds)}%
                </td>
                <td>
                  {formatClock(a.womenSeconds)}, goal beats {pct(a.womenSeconds)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.muted}>
        The averages are real results; the curves around them are an estimate that assumes finish times spread by about{" "}
        {Math.round(FINISH_SPREAD * 100)}% either side, as they do at big city races. Read the percentages as a guide.
      </p>
    </figure>
  );
}
