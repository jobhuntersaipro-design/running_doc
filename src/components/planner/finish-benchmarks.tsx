import { benchmarkFor, formatClock, type FinishBenchmark } from "@/lib/planner";
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
      <AgeChart b={b} goalSeconds={goalSeconds} />
    </section>
  );
}

/** Round-minute ticks across the time range, three to five of them. */
function ticks(lo: number, hi: number): number[] {
  const step = [60, 120, 300, 600, 900, 1800, 3600].find((s) => (hi - lo) / s <= 4) ?? 3600;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

const minutes = (s: number) => (s >= 3600 ? formatClock(s).replace(/:\d\d$/, "") : `${Math.round(s / 60)} min`);

/**
 * Average finish time by age group as a dot plot: a row per age group, a dot
 * for men and a diamond for women, and a line at the runner's goal.
 */
function AgeChart({ b, goalSeconds }: { b: FinishBenchmark; goalSeconds: number }) {
  const values = b.ages.flatMap((a) => [a.menSeconds, a.womenSeconds]).concat(goalSeconds);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.08 || 60;
  const x0 = Math.min(...values) - pad;
  const x1 = Math.max(...values) + pad;
  const pos = (s: number) => `${((s - x0) / (x1 - x0)) * 100}%`;
  const beatsMen = b.ages.filter((a) => goalSeconds < a.menSeconds).length;
  const beatsWomen = b.ages.filter((a) => goalSeconds < a.womenSeconds).length;
  const of = (n: number) => (n === b.ages.length ? `all ${n}` : n === 0 ? "none" : `${n} of ${b.ages.length}`);

  return (
    <figure className={styles.ageChart}>
      <div className={styles.sectionHead}>
        <figcaption className={styles.h3}>By age and gender</figcaption>
        <a className={styles.sourceLink} href={b.agesSource.url} target="_blank" rel="noreferrer">
          Source: {b.agesSource.name}
        </a>
      </div>
      <ul className={styles.ageLegend} aria-hidden="true">
        <li>
          <span className={styles.ageDot} data-kind="men" /> Men
        </li>
        <li>
          <span className={styles.ageDot} data-kind="women" /> Women
        </li>
        <li>
          <span className={styles.ageGoalKey} /> Your goal, {formatClock(goalSeconds)}
        </li>
      </ul>

      <div className={styles.agePlot} aria-hidden="true">
        {b.ages.map((a) => (
          <div key={a.group} className={styles.ageRow} tabIndex={0}>
            <span className={styles.ageLabel}>{a.group}</span>
            <span className={styles.ageTrack}>
              <span className={styles.ageGoal} style={{ left: pos(goalSeconds) }} />
              <span className={styles.ageDot} data-kind="men" style={{ left: pos(a.menSeconds) }} />
              <span className={styles.ageDot} data-kind="women" style={{ left: pos(a.womenSeconds) }} />
              <span className={styles.ageTip}>
                {a.group}: men {formatClock(a.menSeconds)}, women {formatClock(a.womenSeconds)}
              </span>
            </span>
          </div>
        ))}
        <div className={styles.ageRow} data-axis="">
          <span />
          <span className={styles.ageTrack}>
            {ticks(x0, x1).map((v) => (
              <span key={v} className={styles.ageTick} style={{ left: pos(v) }}>
                {minutes(v)}
              </span>
            ))}
          </span>
        </div>
      </div>

      <table className={styles.srOnly}>
        <caption>Average {b.distance} finish time by age group</caption>
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
              <td>{formatClock(a.menSeconds)}</td>
              <td>{formatClock(a.womenSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.muted}>
        Your goal is faster than the average man in {of(beatsMen)} age groups and the average woman in {of(beatsWomen)}. Tap a row
        for its times. Fewer people run at the youngest and oldest ages, so those averages move more from year to year.
      </p>
    </figure>
  );
}
