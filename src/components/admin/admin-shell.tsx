import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { logout } from "@/app/admin/actions";
import styles from "./admin.module.css";

export function AdminShell({
  children,
  signedIn = false,
  back = false,
  home = "/admin",
}: {
  children: ReactNode;
  signedIn?: boolean;
  back?: boolean;
  /** "/admin" for the admin, "/my" for a runner's own races. */
  home?: "/admin" | "/my";
}) {
  return (
    <main className={styles.page}>
      <SiteHeader />
      {signedIn ? (
        <nav className={styles.bar} aria-label="Admin">
          {back ? (
            <Link href={home} className={styles.ghostLink}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              {home === "/admin" ? "All races" : "My races"}
            </Link>
          ) : (
            <span className={styles.barLabel}>{home === "/admin" ? "Admin" : "My races"}</span>
          )}
          <form action={logout}>
            <button type="submit" className={styles.ghostLink}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </nav>
      ) : null}
      {children}
    </main>
  );
}
