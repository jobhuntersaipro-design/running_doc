"use client";

import { useRouter } from "next/navigation";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { removeComment } from "@/app/races/[id]/actions";

/** Lets the admin remove a comment from the admin page. */
export function DeleteComment({ raceId, id }: { raceId: string; id: string }) {
  const router = useRouter();
  return (
    <ConfirmMorph
      label="Delete"
      tone="danger"
      prompt="Delete this comment?"
      confirmLabel="Delete"
      onConfirm={async () => {
        await removeComment(raceId, id);
        router.refresh();
      }}
    />
  );
}
