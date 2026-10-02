"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { setTheme, useTheme } from "./theme";
import styles from "./site.module.css";

type Me = { name: string; admin: boolean } | null;

export function SiteHeader() {
  const theme = useTheme();
  // undefined while loading, so the link does not flash "Sign in" for signed-in runners.
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<Me>)
      .then(setMe, () => setMe(null));
  }, []);
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the tiny app icon needs no optimizing */}
        <img src="/icon.svg" alt="" width={28} height={28} className={styles.brandIcon} />
        <span className={styles.brandName}>Running Doc</span>
      </Link>
      <div className={styles.actions}>
        <Link href="/suggestion" className={styles.navLink}>
          Feedback
        </Link>
        {me === undefined ? null : (
          <Link href={me ? (me.admin ? "/admin" : "/my") : "/signin"} className={styles.navLink}>
            {me ? (me.admin ? "Admin" : "My races") : "Sign in"}
          </Link>
        )}
        <ThemeSwitch theme={theme} onThemeChange={setTheme} iconOnly label="Switch theme" />
      </div>
    </header>
  );
}
