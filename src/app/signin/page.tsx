import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/arc/alert/alert";
import { AdminShell } from "@/components/admin/admin-shell";
import { getUser, safeNext } from "@/lib/server/auth";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage(props: PageProps<"/signin">) {
  const { next, error } = await props.searchParams;
  const to = safeNext(typeof next === "string" ? next : null);
  if (await getUser()) redirect(to === "/" ? "/my" : to);
  return (
    <AdminShell>
      <section className={styles.loginCard} aria-labelledby="signin-heading">
        <div className={styles.headText}>
          <h1 id="signin-heading" className={styles.title}>
            Sign in
          </h1>
          <p className={styles.lede}>
            Sign in or sign up with your Google account to upload your own races, route maps and documents.
          </p>
        </div>
        {error ? (
          <Alert tone="danger" title="Could not sign in">
            Google sign-in did not finish. Try again.
          </Alert>
        ) : null}
        <a href={`/api/auth/google?next=${encodeURIComponent(to === "/" ? "/my" : to)}`} className={styles.primaryLink}>
          Continue with Google
        </a>
      </section>
    </AdminShell>
  );
}
