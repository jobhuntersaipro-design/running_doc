"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { publishRace, unpublishRace } from "@/app/admin/actions";
import styles from "./admin.module.css";

/**
 * Publishes a runner's race with a deliberate hold, since it then shows to
 * everyone; making it private again is one click. Publishing a race that is
 * already public elsewhere redirects to that race instead.
 */
export function PublishRace({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(publish: boolean) {
    setError(undefined);
    startTransition(async () => {
      const res = await (publish ? publishRace(id) : unpublishRace(id));
      if (res.error) {
        setDone(false);
        setError(res.error);
      } else if (publish) router.replace(`${pathname}?published=${encodeURIComponent(id)}`, { scroll: false });
      else router.refresh();
    });
  }

  return (
    <span className={styles.publish}>
      {published ? (
        <Button variant="ghost" size="sm" loading={pending} onClick={() => run(false)}>
          Make private
        </Button>
      ) : (
        <HoldToConfirm
          label="Hold to publish"
          confirmedLabel="Published"
          icon={<Globe strokeWidth={1.75} />}
          confirmed={done}
          disabled={pending}
          onConfirm={() => {
            setDone(true);
            run(true);
          }}
        />
      )}
      {error ? (
        <span role="alert" className={styles.publishError}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
