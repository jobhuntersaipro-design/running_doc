"use client";

import { Badge } from "@/components/arc/badge/badge";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { averageHr, formatClock, formatPace, hrZoneFor, paceZoneFor, type CourseZones, type EffortTag, type Plan } from "@/lib/planner";
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
      <p className={styles.muted}>
        Each row is the kilometre that ends at that marker. Pace changes with the hills so the effort stays even and the total
        still hits your goal. Heart rate is an estimate from your zones; set them in the Zones tab.
      </p>
      <SortableDataTable rows={rows} columns={columns} rowKey="id" caption="Kilometre splits" itemName={{ one: "split", other: "splits" }} />
    </div>
  );
}
