"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { deleteRace } from "@/app/admin/actions";
import styles from "./admin.module.css";

/**
 * Deletes a race with a deliberate hold: its course, files, comments and saved goals go and cannot
 * come back. Afterwards it goes to `then`, or refreshes the list it sits in.
 */
export function DeleteRace({ id, name, then }: { id: string; name: string; then?: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <span className={styles.publish}>
      <HoldToConfirm
        label="Hold to delete"
        confirmedLabel="Deleted"
        tone="danger"
        title={`Hold to delete ${name}`}
        confirmed={done}
        disabled={pending}
        onConfirm={() => {
          setDone(true);
          setError(undefined);
          startTransition(async () => {
            const res = await deleteRace(id);
            if (res.error) {
              setDone(false);
              setError(res.error);
            } else if (then) router.push(then);
            else router.refresh();
          });
        }}
      />
      {error ? (
        <span role="alert" className={styles.publishError}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
