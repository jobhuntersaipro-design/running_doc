"use client";

import Link from "next/link";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import type { Runner } from "@/lib/server/runners";
import styles from "./admin.module.css";

export type RunnerRow = Runner & { goalCount: number; raceCount: number; commentCount: number; reactionCount: number };

// ponytail: Malaysia time for every viewer, so server and browser render the same text. Use the viewer's zone if admins move.
const signedUp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

const columns: DataColumn<RunnerRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (v, row) => (
      <span className={styles.who}>
        <Link href={`/admin?tab=runners&runner=${encodeURIComponent(row.email)}`}>{String(v || row.email)}</Link>
        <small>{row.email}</small>
      </span>
    ),
  },
  { key: "signedUpAt", label: "Signed up", render: (v) => signedUp.format(new Date(String(v))) },
  { key: "lastSignInAt", label: "Last sign-in", render: (v) => signedUp.format(new Date(String(v))) },
  { key: "goalCount", label: "Goals" },
  { key: "raceCount", label: "Races" },
  { key: "commentCount", label: "Comments" },
  { key: "reactionCount", label: "Reactions" },
];

/** Everyone who has signed in with Google, for the admin. A name opens that runner's log. */
export function RunnersTable({ runners }: { runners: RunnerRow[] }) {
  return (
    <SortableDataTable
      rows={runners}
      columns={columns}
      rowKey="email"
      caption="Runners who have signed up"
      emptyMessage="No runners have signed up yet."
      itemName={{ one: "runner", other: "runners" }}
      defaultSort={{ key: "signedUpAt", direction: "desc" }}
    />
  );
}
