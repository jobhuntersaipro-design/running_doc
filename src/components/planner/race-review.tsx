"use client";

import { useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { formatClock, formatPace, parseRun, reviewRun, type Plan, type RunReview } from "@/lib/planner";
import styles from "./planner.module.css";

/** "+0:42" slower or "−0:15" faster than planned. */
const diff = (seconds: number) => `${seconds >= 0 ? "+" : "−"}${span(Math.abs(seconds))}`;
/** "8:47" under an hour, "1:02:10" over. */
const span = (seconds: number) => (seconds < 3600 ? formatPace(Math.round(seconds)) : formatClock(Math.round(seconds)));

type Row = { id: string; km: number; planned: number; actual: number; diff: number; hr?: number };

/** What happened against the plan: the runner uploads the GPX their watch recorded. Nothing leaves the device. */
export function RaceReview({ plan }: { plan: Plan }) {
  const [review, setReview] = useState<RunReview | { error: string } | null>(null);

  async function pick(files: File[]) {
    const f = files[0];
    if (!f) return setReview(null);
    try {
      setReview(reviewRun(plan, parseRun(await f.text())));
    } catch (e) {
      setReview({ error: e instanceof Error ? e.message : "This file could not be read" });
    }
  }

  const ok = review && "splits" in review ? review : null;
  const goal = plan.summary.goalSeconds;
  const rows: Row[] = (ok?.splits ?? []).map((s) => ({
    id: String(s.km),
    km: s.km,
    planned: s.plannedSeconds,
    actual: s.actualSeconds,
    diff: s.actualSeconds - s.plannedSeconds,
    hr: s.hr,
  }));
  // The last km where the runner was still within a minute of the plan, counting from the start.
  let running = 0;
  let onPlanUntil = 0;
  for (const r of rows) {
    running += r.diff;
    if (Math.abs(running) > 60) break;
    onPlanUntil = r.km;
  }
  const lost = [...rows].sort((a, b) => b.diff - a.diff).filter((r) => r.diff > 5).slice(0, 3);
  const hillLoss = (ok?.uphills ?? []).reduce((s, h) => s + h.actualSeconds - h.plannedSeconds, 0);
  const hasHr = rows.some((r) => r.hr !== undefined);

  const columns: DataColumn<Row>[] = [
    { key: "km", label: "Km", numeric: true, render: (_, r) => (r.km === rows.length && plan.splits.at(-1)!.lengthKm < 1 ? "Finish" : r.km) },
    { key: "planned", label: "Plan", numeric: true, render: (v) => formatPace(Number(v)) },
    { key: "actual", label: "You", numeric: true, render: (v) => formatPace(Number(v)) },
    { key: "diff", label: "Difference", sortable: true, numeric: true, render: (v) => <span className={Number(v) > 5 ? styles.behind : Number(v) < -5 ? styles.ahead : undefined}>{diff(Number(v))}</span> },
    ...(hasHr ? [{ key: "hr" as const, label: "Heart rate", numeric: true, render: (v: unknown) => (v === undefined ? "" : `${v} bpm`) }] : []),
  ];

  return (
    <section className={styles.section} aria-labelledby="review-heading">
      <h2 id="review-heading" className={styles.h2}>
        After the race: plan vs actual
      </h2>
      <p className={styles.muted}>
        Export your run as GPX (Garmin Connect: the activity&apos;s gear menu, Export to GPX. Strava: the ··· menu, Export GPX. COROS:
        share, GPX) and drop it here to see where you gained or lost time. The file stays on your device.
      </p>
      <FileDropzone
        label="Your run"
        description="The GPX your watch or phone recorded"
        accept=".gpx,application/gpx+xml"
        multiple={false}
        maxFiles={1}
        maxSize={20 * 1024 * 1024}
        note="GPX with time on each point"
        onFilesChange={pick}
      />
      {review && "error" in review ? (
        <Alert tone="danger" title="This run could not be compared">
          {review.error}.
        </Alert>
      ) : null}
      {ok ? (
        <>
          <p className={styles.summary}>
            You finished in <span className={styles.num}>{formatClock(ok.finishSeconds)}</span>,{" "}
            {Math.abs(ok.finishSeconds - goal) < 30 ? (
              "right on your goal"
            ) : (
              <>
                <span className={styles.num}>{span(Math.abs(ok.finishSeconds - goal))}</span> {ok.finishSeconds > goal ? "slower" : "faster"} than
                your goal
              </>
            )}{" "}
            of <span className={styles.num}>{formatClock(goal)}</span>. First half <span className={styles.num}>{formatClock(ok.firstHalfSeconds)}</span>,
            second half <span className={styles.num}>{formatClock(ok.secondHalfSeconds)}</span>
            {ok.secondHalfSeconds > ok.firstHalfSeconds * 1.03 ? ": you slowed in the second half." : ok.secondHalfSeconds < ok.firstHalfSeconds ? ": a negative split, well paced." : ": nicely even."}
          </p>
          <ul className={styles.tips}>
            <li>
              {onPlanUntil >= rows.length
                ? "You stayed within a minute of the plan the whole way."
                : onPlanUntil
                  ? `You were within a minute of the plan until km ${onPlanUntil}.`
                  : "You were more than a minute off the plan within the first km."}
            </li>
            {lost.length ? <li>Most time lost: {lost.map((r) => `km ${r.km} (${diff(r.diff)})`).join(", ")}.</li> : null}
            {ok.uphills.length ? (
              <li>
                On the {ok.uphills.length} uphill{ok.uphills.length > 1 ? "s" : ""} you{" "}
                {Math.abs(hillLoss) <= 5 ? "matched the plan" : `${hillLoss > 0 ? "lost" : "gained"} ${span(Math.abs(hillLoss))} on the plan`}
                {hillLoss > 5 && ok.uphills.length > 1
                  ? `, most on the one from km ${[...ok.uphills].sort((a, b) => b.actualSeconds - b.plannedSeconds - (a.actualSeconds - a.plannedSeconds))[0].hill.startKm.toFixed(1)}`
                  : ""}
                .
              </li>
            ) : null}
            <li>
              Your watch measured <span className={styles.num}>{ok.gpsKm.toFixed(2)} km</span>; it is stretched to the official{" "}
              {plan.summary.totalKm.toFixed(1)} km so each km lines up with the plan. The time runs from when you started your watch.
            </li>
          </ul>
          <div className={styles.desktopOnly}>
            <SortableDataTable rows={rows} columns={columns} rowKey="id" caption="Each km, planned and actual" itemName={{ one: "km", other: "km" }} />
          </div>
          <ol className={`${styles.cardList} ${styles.mobileOnly}`} aria-label="Each km, planned and actual">
            {rows.map((r) => (
              <li key={r.id} className={styles.cardItem}>
                <div className={styles.cardMain}>
                  <span className={styles.cardTitle}>{r.km === rows.length && plan.splits.at(-1)!.lengthKm < 1 ? "Finish" : `Km ${r.km}`}</span>
                  <span className={`${styles.cardValue} ${styles.num} ${r.diff > 5 ? styles.behind : r.diff < -5 ? styles.ahead : ""}`}>{diff(r.diff)}</span>
                </div>
                <p className={`${styles.cardMeta} ${styles.num}`}>
                  Plan {formatPace(r.planned)}, you {formatPace(r.actual)}
                  {r.hr !== undefined ? `, ${r.hr} bpm` : ""}
                </p>
              </li>
            ))}
          </ol>
          <p className={styles.muted}>Compared with the plan for the goal above. Change the goal to compare with another.</p>
        </>
      ) : null}
    </section>
  );
}
