"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Switch } from "@/components/arc/switch/switch";
import { publishRace, unpublishRace } from "@/app/admin/actions";
import styles from "./admin.module.css";

/**
 * Switches a runner's race between public and private. Publishing a race that is
 * already public elsewhere redirects to that race instead.
 */
export function PublishRace({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(published);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    setError(undefined);
    startTransition(async () => {
      const res = await (next ? publishRace(id) : unpublishRace(id));
      if (res.error) {
        setOn(!next);
        setError(res.error);
      } else router.refresh();
    });
  }

  return (
    <span className={styles.publish}>
      <Switch label={on ? "Public" : "Private"} checked={on} onCheckedChange={toggle} disabled={pending} />
      {error ? (
        <span role="alert" className={styles.publishError}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
