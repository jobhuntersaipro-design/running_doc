import { benchmarkFor, formatClock } from "@/lib/planner";
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
            <span className={styles.benchDot} />
            <span className={styles.benchLabel}>{m.key === "goal" ? "You" : m.key === "men" ? "Men" : "Women"}</span>
          </span>
        ))}
      </div>
      <p className={styles.muted}>
        Your goal is {gap(goalSeconds, b.menSeconds)} the average man and {gap(goalSeconds, b.womenSeconds)} the average woman.
        These averages come from big-event results, not this race. Hot, humid or hilly races are usually slower.
      </p>
    </section>
  );
}
