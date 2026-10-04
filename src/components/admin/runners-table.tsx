"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { SearchField } from "@/components/arc/search-field/search-field";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import type { Runner } from "@/lib/server/runners";
import styles from "./admin.module.css";

/** New: signed up in the last 7 days. Active: signed in during them. */
export type Activity = "New" | "Active" | "Inactive";
export type RunnerRow = Runner & { activity: Activity; goalCount: number; raceCount: number; commentCount: number; reactionCount: number };

const TONE = { New: "info", Active: "success", Inactive: "neutral" } as const;

// ponytail: Malaysia time for every viewer, so server and browser render the same text. Use the viewer's zone if admins move.
const signedUp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

const columns: DataColumn<RunnerRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (v, row) => (
      <span className={styles.who}>
        <Avatar name={String(v || row.email)} size="sm" />
        <span>
          <Link href={`/admin?tab=runners&runner=${encodeURIComponent(row.email)}`}>{String(v || row.email)}</Link>
          <small>{row.email}</small>
        </span>
      </span>
    ),
  },
  {
    key: "activity",
    label: "Status",
    render: (v) => (
      <Badge tone={TONE[v as Activity]} size="sm">
        {String(v)}
      </Badge>
    ),
  },
  { key: "signedUpAt", label: "Signed up", render: (v) => day.format(new Date(String(v))) },
  { key: "lastSignInAt", label: "Last sign-in", render: (v) => signedUp.format(new Date(String(v))) },
  { key: "goalCount", label: "Goals" },
  { key: "raceCount", label: "Races" },
  { key: "commentCount", label: "Comments" },
  { key: "reactionCount", label: "Reactions" },
];

/** Everyone who has signed in with Google, for the admin, with a search. A name opens that runner's log. */
export function RunnersTable({ runners }: { runners: RunnerRow[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? runners.filter((r) => r.name.toLowerCase().includes(q) || r.email.includes(q)) : runners;
  return (
    <div className={styles.runners}>
      <SearchField label="Search runners" placeholder="Name or email" value={query} onValueChange={setQuery} />
      <SortableDataTable
      rows={shown}
      columns={columns}
      rowKey="email"
      caption="Runners who have signed up"
      emptyMessage={q ? "No runner matches that search." : "No runners have signed up yet."}
      itemName={{ one: "runner", other: "runners" }}
      defaultSort={{ key: "signedUpAt", direction: "desc" }}
      />
    </div>
  );
}
