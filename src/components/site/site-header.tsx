"use client";

import Link from "next/link";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { setTheme, useTheme } from "./theme";
import styles from "./site.module.css";

export function SiteHeader() {
  const theme = useTheme();
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Race plan
      </Link>
      <ThemeSwitch theme={theme} onThemeChange={setTheme} iconOnly label="Switch theme" />
    </header>
  );
}
