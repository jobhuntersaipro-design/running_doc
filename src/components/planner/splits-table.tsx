"use client";

import { useState } from "react";
import { Badge } from "@/components/arc/badge/badge";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { averageHr, formatClock, formatPace, hrZoneFor, paceZoneFor, type CourseZones, type EffortTag, type Plan } from "@/lib/planner";
import { SplitBars } from "./split-bars";
import { TAG_LABEL, clockAt } from "./util";
import styles from "./planner.module.css";

type Row = {
  id: string;
  km: number;
  pace: number;
  split: number;
  total: number;
  grade: number;
  tag: EffortTag;
  paceZone: number;
  hr: number;
  hrZone: number;
  notes: string;
};

export function SplitsTable({ plan, zones, startTime }: { plan: Plan; zones: CourseZones; startTime: string }) {
  const [view, setView] = useState("chart");
  const rows: Row[] = plan.splits.map((s) => ({
    id: String(s.km),
    km: s.km,
    pace: s.paceSecPerKm,
    split: s.splitSeconds,
    total: s.cumulativeSeconds,
    grade: s.avgGrade,
    tag: s.tag,
    paceZone: paceZoneFor(zones.thresholdPace, s.paceSecPerKm),
    hr: averageHr(zones, s.startKm, s.endKm),
    hrZone: hrZoneFor(zones.hrZones, averageHr(zones, s.startKm, s.endKm)),
    notes: s.events.map((e) => e.title).join(", "),
  }));

  const columns: DataColumn<Row>[] = [
    { key: "km", label: "Km", sortable: true, numeric: true, render: (_, r) => (r.km === plan.splits.length && plan.splits.at(-1)!.lengthKm < 1 ? "Finish" : r.km) },
    { key: "pace", label: "Pace", sortable: true, numeric: true, render: (v) => `${formatPace(Number(v))}/km` },
    { key: "split", label: "Split", numeric: true, render: (v) => formatPace(Number(v)) },
    { key: "total", label: "Race time", numeric: true, render: (v) => formatClock(Number(v)) },
    { key: "clock", label: "Clock", numeric: true, render: (_, r) => clockAt(startTime, r.total) },
    { key: "grade", label: "Grade", sortable: true, numeric: true, render: (v) => `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` },
    { key: "paceZone", label: "Pace zone", sortable: true, numeric: true, render: (v) => `Z${v}` },
    { key: "hr", label: "Heart rate", sortable: true, numeric: true, render: (_, r) => `${r.hr} bpm, Z${r.hrZone}` },
    { key: "tag", label: "Effort", render: (v) => <Badge size="sm" tone={v === "push" ? "info" : "neutral"}>{TAG_LABEL[v as EffortTag]}</Badge> },
    { key: "notes", label: "On this km" },
  ];

  return (
    <div className={styles.panel}>
      <SegmentedControl
        label="Splits view"
        value={view}
        onValueChange={setView}
        options={[
          { value: "chart", label: "Chart" },
          { value: "table", label: "Table" },
        ]}
      />
      <p className={styles.muted}>
        Each row is the kilometre that ends at that marker. Pace changes with the hills so the effort stays even and the total
        still hits your goal. Heart rate is an estimate from your zones; set them in the Zones tab.
      </p>
      {view === "chart" ? (
        <SplitBars plan={plan} />
      ) : (
        <>
          <div className={styles.desktopOnly}>
            <SortableDataTable rows={rows} columns={columns} rowKey="id" caption="Kilometre splits" itemName={{ one: "split", other: "splits" }} />
          </div>
          {/* Phones get one readable card per kilometre instead of a squeezed table. */}
          <ol className={`${styles.cardList} ${styles.mobileOnly}`} aria-label="Kilometre splits">
            {rows.map((r) => {
              const last = r.km === plan.splits.length && plan.splits.at(-1)!.lengthKm < 1;
              return (
                <li key={r.id} className={styles.cardItem}>
                  <div className={styles.cardMain}>
                    <span className={styles.cardTitle}>{last ? "Finish" : `Km ${r.km}`}</span>
                    <span className={`${styles.cardValue} ${styles.num}`}>{formatPace(r.pace)}/km</span>
                    <Badge size="sm" tone={r.tag === "push" ? "info" : "neutral"}>{TAG_LABEL[r.tag]}</Badge>
                  </div>
                  <p className={`${styles.cardMeta} ${styles.num}`}>
                    {formatClock(r.total)} at {clockAt(startTime, r.total)}, {r.grade >= 0 ? "+" : ""}
                    {r.grade.toFixed(1)}% grade
                  </p>
                  <p className={`${styles.cardMeta} ${styles.num}`}>
                    Pace Z{r.paceZone}, heart rate {r.hr} bpm (Z{r.hrZone})
                  </p>
                  {r.notes ? <p className={styles.cardNotes}>{r.notes}</p> : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
