import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { logout } from "@/app/admin/actions";
import styles from "./admin.module.css";

export function AdminShell({ children, signedIn = false, back = false }: { children: ReactNode; signedIn?: boolean; back?: boolean }) {
  return (
    <main className={styles.page}>
      <SiteHeader />
      {signedIn ? (
        <nav className={styles.bar} aria-label="Admin">
          {back ? (
            <Link href="/admin" className={styles.ghostLink}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              All races
            </Link>
          ) : (
            <span className={styles.barLabel}>Admin</span>
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
