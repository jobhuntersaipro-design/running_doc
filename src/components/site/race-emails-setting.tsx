"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/arc/switch/switch";
import { setMyRaceEmails } from "@/app/settings/actions";
import adminStyles from "@/components/admin/admin.module.css";

/** The switch for emails about newly published races. It applies at once and flips back if saving fails. */
export function RaceEmailsSetting({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setOn(next);
    setError(undefined);
    startTransition(async () => {
      const res = await setMyRaceEmails(next);
      if (res.error) {
        setOn(!next);
        setError(res.error);
      }
    });
  }

  return (
    <section className={adminStyles.section} aria-labelledby="emails-heading">
      <div className={adminStyles.headText}>
        <h2 id="emails-heading" className={adminStyles.h2}>
          Emails
        </h2>
        <p className={adminStyles.muted}>When a race is published, we email you where and when it is with a link to its plan.</p>
      </div>
      <Switch label="Email me about new races" checked={on} onCheckedChange={change} disabled={pending} />
      {error ? (
        <p role="alert" className={adminStyles.fieldError}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
