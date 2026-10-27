import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { RaceEmailsSetting } from "@/components/site/race-emails-setting";
import { ProfileForm, ZoneSettingsForm } from "@/components/site/settings-forms";
import { EMPTY_PROFILE } from "@/lib/planner";
import { getUser } from "@/lib/server/auth";
import { getProfile, getRaceEmails } from "@/lib/server/runners";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/settings");
  const [profile, raceEmails] = await Promise.all([
    getProfile(user.email)
      .catch((e) => {
        console.error("Reading profile failed:", e);
        return null;
      })
      .then((p) => p ?? EMPTY_PROFILE),
    getRaceEmails(user.email).catch(() => null),
  ]);
  return (
    <AdminShell>
      <div className={styles.headText}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.lede}>Signed in as {user.email}. These make your race plans and rehearsals fit you.</p>
      </div>
      <ProfileForm initial={profile} />
      <ZoneSettingsForm />
      {raceEmails === null ? null : <RaceEmailsSetting initial={raceEmails} />}
    </AdminShell>
  );
}
