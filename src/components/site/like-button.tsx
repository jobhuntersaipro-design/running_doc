"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { likeRace } from "@/app/races/[id]/actions";
import type { Likes } from "@/lib/server/likes";
import styles from "./site.module.css";

/** Likes a race event. Signed-out runners are sent to sign in first. The count moves at once and settles on the server's. */
export function LikeButton({ raceId, event, likes, signedIn }: { raceId: string; event: string; likes: Likes; signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [shown, show] = useOptimistic(likes);
  const [error, setError] = useState<string>();

  function toggle() {
    if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    setError(undefined);
    startTransition(async () => {
      show({ count: shown.count + (shown.mine ? -1 : 1), mine: !shown.mine });
      const res = await likeRace(raceId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <span className={styles.like}>
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={shown.mine}
        aria-label={`${shown.mine ? "Unlike" : signedIn ? "Like" : "Sign in to like"} ${event}, ${shown.count} ${shown.count === 1 ? "like" : "likes"}`}
        onClick={toggle}
      >
        <Heart size={16} strokeWidth={1.75} fill={shown.mine ? "currentColor" : "none"} aria-hidden="true" className={shown.mine ? styles.liked : undefined} />
        {shown.count}
      </Button>
      {error ? (
        <span role="alert" className={styles.likeError}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
