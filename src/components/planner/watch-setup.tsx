"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { buildFitWorkout } from "@/lib/export/fit";
import { formatClock, formatPace, type Plan } from "@/lib/planner";
import { slug } from "./util";
import styles from "./planner.module.css";

type Brand = "garmin" | "coros" | "apple";

const TOLERANCE = 8;

function download(plan: Plan) {
  const bytes = buildFitWorkout(plan, { toleranceSec: TOLERANCE, name: `${formatClock(plan.summary.goalSeconds)} plan` });
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/vnd.ant.fit" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(plan.name)}-${slug(formatClock(plan.summary.goalSeconds))}.fit`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WatchSetup({ plan }: { plan: Plan }) {
  const [brand, setBrand] = useState<Brand>("garmin");
  const goalPace = formatPace(plan.summary.goalPaceSecPerKm);

  return (
    <div className={styles.panel}>
      <SegmentedControl
        label="Watch brand"
        value={brand}
        onValueChange={(v) => setBrand(v as Brand)}
        options={[
          { value: "garmin", label: "Garmin" },
          { value: "coros", label: "Coros" },
          { value: "apple", label: "Apple Watch" },
        ]}
      />

      {brand === "garmin" ? (
        <div className={styles.watchBody}>
          <p>
            The workout file has one step per kilometre with a pace range of plus or minus {TOLERANCE} seconds, so the watch
            buzzes when you drift out of it.
          </p>
          <div>
            <Button variant="secondary" onClick={() => download(plan)}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              Download workout file
            </Button>
          </div>
          <ol className={styles.steps}>
            <li>Connect the watch to your computer with its cable.</li>
            <li>
              Copy the .fit file into the <code>GARMIN/NewFiles</code> folder on the watch. On a Mac, newer watches need a file
              transfer app such as OpenMTP to show up.
            </li>
            <li>Unplug the watch. It imports the file into your saved workouts.</li>
            <li>On race morning, open Run, then Training, then Workouts, and pick the plan before you start.</li>
          </ol>
        </div>
      ) : null}

      {brand === "coros" ? (
        <div className={styles.watchBody}>
          <p>Build the plan in the Coros app as a structured run, one step per block below. Menu names can differ between app versions.</p>
          <ol className={styles.steps}>
            <li>In the Coros app, open Workouts and create a new run workout.</li>
            <li>Add one training step per block, set it to distance, and enter the block length.</li>
            <li>Set each step&apos;s target to pace and use the range shown below.</li>
            <li>Save and sync. On the watch, start Run and choose the workout from the training menu.</li>
          </ol>
          <BlocksTable plan={plan} />
        </div>
      ) : null}

      {brand === "apple" ? (
        <div className={styles.watchBody}>
          <p>Apple Watch cannot import workout files, so set it up by hand. You need watchOS 9 or later.</p>
          <ol className={styles.steps}>
            <li>Open the Workout app, tap the more button on Outdoor Run, then Create Workout, then Custom.</li>
            <li>Add a work step per block below. Set the goal to distance and the alert to a pace range.</li>
            <li>
              For a simpler setup, use a single pace alert around {goalPace}/km and rely on the pace band for the hills.
            </li>
            <li>Start the custom workout at the start line.</li>
          </ol>
          <BlocksTable plan={plan} />
        </div>
      ) : null}

      <div className={styles.watchTips}>
        <h3 className={styles.h3}>On every watch</h3>
        <ul className={styles.tips}>
          <li>
            Watches usually read long in a city. Tall buildings bend the GPS signal and you rarely run the perfect racing line,
            so expect to be 1 to 2% ahead of the official markers by the end.
          </li>
          <li>Trust the race clock at each marker more than the watch distance. The pace band has the time to hit at every km.</li>
          <li>Show lap pace, race time and distance on the main screen. Charge the watch and sync it the day before.</li>
        </ul>
      </div>
    </div>
  );
}

function BlocksTable({ plan }: { plan: Plan }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.simpleTable}>
        <caption className={styles.srOnly}>Pace blocks for manual watch setup</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Distance</th>
            <th scope="col">Pace range</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {plan.blocks.map((b, i) => (
            <tr key={b.startKm}>
              <td className={styles.num}>{i + 1}</td>
              <td className={styles.num}>
                {(b.endKm - b.startKm).toFixed(2)} km
                <span className={styles.muted}> (km {b.startKm.toFixed(0)} to {b.endKm.toFixed(1)})</span>
              </td>
              <td className={styles.num}>
                {formatPace(b.paceSecPerKm - TOLERANCE)} to {formatPace(b.paceSecPerKm + TOLERANCE)}
              </td>
              <td>{b.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
