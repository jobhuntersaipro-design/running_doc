import type { Metadata } from "next";
import Link from "next/link";
import { MailX } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AdminShell } from "@/components/admin/admin-shell";
import { validUnsubscribe } from "@/lib/server/announce";
import { getRaceEmails } from "@/lib/server/runners";
import { setRaceEmailsFromLink } from "./actions";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/** Where the unsubscribe link in a new-race email lands: one button to stop the emails, one to turn them back on. */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const { e, t, failed } = await props.searchParams;
  const email = typeof e === "string" ? e : "";
  const token = typeof t === "string" ? t : "";
  const on = email && validUnsubscribe(email, token) ? await getRaceEmails(email).catch(() => null) : null;

  if (on === null)
    return (
      <AdminShell>
        <EmptyState
          icon={<MailX width={24} height={24} strokeWidth={1.5} />}
          title="This link does not work"
          description="Open the unsubscribe link in your latest Running Doc email, or sign in and turn new race emails off in Settings."
          action={<Link href="/settings">Open Settings</Link>}
        />
      </AdminShell>
    );

  return (
    <AdminShell>
      <div className={styles.headText}>
        <h1 className={styles.title}>{on ? "Stop new race emails?" : "You are unsubscribed"}</h1>
        <p className={styles.lede}>
          {on
            ? `We email ${email} when a race is published on Running Doc, with where and when it is and a link to its plan.`
            : `We will not email ${email} about new races. You can turn them back on here or in Settings.`}
        </p>
      </div>
      {failed ? (
        <Alert tone="danger" title="Not saved">
          Your choice could not be saved. Try again in a moment.
        </Alert>
      ) : null}
      <form action={setRaceEmailsFromLink}>
        <input type="hidden" name="e" value={email} />
        <input type="hidden" name="t" value={token} />
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <Button type="submit" variant={on ? "primary" : "secondary"}>
          {on ? "Unsubscribe" : "Turn new race emails back on"}
        </Button>
      </form>
    </AdminShell>
  );
}
