"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flag, HeartPulse, Settings, ShieldCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { logout } from "@/app/admin/actions";
import { setTheme, useTheme } from "./theme";
import styles from "./site.module.css";

type Me = { name: string; email: string; admin: boolean } | null;

const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function SiteHeader() {
  const theme = useTheme();
  const router = useRouter();
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
        <ThemeSwitch theme={theme} onThemeChange={setTheme} iconOnly label="Switch theme" />
        {me === undefined ? null : me ? (
          <UserMenu
            user={me}
            showTheme={false}
            items={[
              me.admin
                ? { label: "Admin", icon: <ShieldCheck {...icon} />, onSelect: () => router.push("/admin") }
                : { label: "My races", icon: <Flag {...icon} />, onSelect: () => router.push("/my") },
              { label: "Heart rate zones", icon: <HeartPulse {...icon} />, onSelect: () => router.push("/settings#heart-rate-zones") },
              { label: "Settings", icon: <Settings {...icon} />, onSelect: () => router.push("/settings") },
            ]}
            onSignOut={() => logout()}
          />
        ) : (
          <Link href="/signin" className={styles.navLink}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
