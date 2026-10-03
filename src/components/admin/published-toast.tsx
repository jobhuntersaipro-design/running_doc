"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Toast from "@/components/arc/toast/toast";
import styles from "./admin.module.css";

/** Confirms a publish. Shown from ?published=<id>, which is cleared when the toast closes. */
export function PublishedToast({ name }: { name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.toastSpot}>
      <Toast
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.replace(pathname, { scroll: false });
      }}
      title="Race published"
      description={`${name} now shows on the overview for everyone.`}
      />
    </div>
  );
}
