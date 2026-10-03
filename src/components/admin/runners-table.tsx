"use client";

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import type { Runner } from "@/lib/server/runners";

type Row = Runner & { goalCount: number; details: string[] };

// ponytail: Malaysia time for every viewer, so server and browser render the same text. Use the viewer's zone if admins move.
const signedUp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

const columns: DataColumn<Row>[] = [
  { key: "name", label: "Name", render: (v) => String(v || "–") },
  { key: "email", label: "Email" },
  { key: "signedUpAt", label: "Signed up", render: (v) => signedUp.format(new Date(String(v))) },
  { key: "lastSignInAt", label: "Last sign-in", render: (v) => signedUp.format(new Date(String(v))) },
  { key: "goalCount", label: "Goals" },
  {
    key: "details",
    label: "Details",
    render: (_, row) => (
      <details>
        <summary>View</summary>
        <ul>
          {row.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </details>
    ),
  },
];

/** Everyone who has signed in with Google, for the admin. */
export function RunnersTable({ runners }: { runners: Row[] }) {
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
