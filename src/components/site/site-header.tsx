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
        Running Doc
      </Link>
      <div className={styles.actions}>
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
