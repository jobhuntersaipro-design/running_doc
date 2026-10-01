"use client";

import { Badge } from "@/components/arc/badge/badge";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { formatPace, type Plan } from "@/lib/planner";
import styles from "./planner.module.css";

type Row = {
  id: string;
  startKm: number;
  kind: "uphill" | "downhill";
  elevation: string;
  change: number;
  lengthKm: number;
  avgGrade: number;
  steepest: number;
  pace: number;
  incline: number | null;
};

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export function HillsTable({ plan }: { plan: Plan }) {
  const rows: Row[] = plan.hills.map((h) => ({
    id: `${h.kind}-${h.startKm}`,
    startKm: h.startKm,
    kind: h.kind,
    elevation: `${Math.round(h.startEle)} to ${Math.round(h.peakEle)} m`,
    change: h.kind === "uphill" ? h.change : -h.change,
    lengthKm: h.lengthKm,
    avgGrade: h.avgGrade,
    steepest: h.steepestGrade,
    pace: h.paceSecPerKm,
    incline: h.treadmillIncline,
  }));

  const columns: DataColumn<Row>[] = [
    { key: "startKm", label: "From km", sortable: true, numeric: true, render: (v) => Number(v).toFixed(1) },
    { key: "kind", label: "Type", render: (v) => <Badge size="sm">{v === "uphill" ? "Uphill" : "Downhill"}</Badge> },
    { key: "elevation", label: "Elevation" },
    { key: "change", label: "Change", sortable: true, numeric: true, render: (v) => `${Number(v) >= 0 ? "+" : ""}${Math.round(Number(v))} m` },
    { key: "lengthKm", label: "Length", numeric: true, render: (v) => `${Number(v).toFixed(1)} km` },
    { key: "avgGrade", label: "Gradient", sortable: true, numeric: true, render: (v) => signed(Number(v)) },
    { key: "steepest", label: "Steepest", numeric: true, render: (v) => signed(Number(v)) },
    { key: "pace", label: "Target pace", numeric: true, render: (v) => `${formatPace(Number(v))}/km` },
    { key: "incline", label: "Treadmill", numeric: true, render: (v) => (v === null ? "Outdoors" : `${v}%`) },
  ];

  const uphills = plan.hills.filter((h) => h.kind === "uphill");
  const biggest = [...uphills].sort((a, b) => b.change - a.change)[0];

  return (
    <div className={styles.panel}>
      <p className={styles.muted}>
        Gradient is the typical slope over the main part of each hill. The treadmill setting is that slope plus 1%, which makes
        up for the missing air resistance on a belt.
      </p>
      {rows.length ? (
        <SortableDataTable rows={rows} columns={columns} rowKey="id" caption="Uphills and downhills" itemName={{ one: "hill", other: "hills" }} />
      ) : (
        <p className={styles.muted}>This course is flat enough that no uphill or downhill needs its own plan.</p>
      )}
      {biggest ? (
        <div className={styles.watchTips}>
          <h3 className={styles.h3}>Practise it on a treadmill</h3>
          <ul className={styles.tips}>
            <li>
              Copy the biggest uphill: {biggest.lengthKm.toFixed(1)} km at {biggest.treadmillIncline}% incline and{" "}
              {formatPace(biggest.paceSecPerKm)}/km, then 2 to 3 minutes of easy flat jogging. Start with 2 repeats and build
              to 4 over a few weeks.
            </li>
            <li>Keep the effort the same as on the flat. If you are gasping, slow the belt rather than lowering the incline.</li>
            <li>Most treadmills cannot go downhill, so practise the downhills outdoors: quick, light steps and relaxed shoulders.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
