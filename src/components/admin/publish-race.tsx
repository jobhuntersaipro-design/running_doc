"use client";

import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { publishRace } from "@/app/admin/actions";

/** Publishes a runner's race. The action redirects to the race, or to the public race it would duplicate. */
export function PublishRace({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmMorph
      label="Publish"
      tone="neutral"
      prompt={`Publish ${name} for everyone?`}
      confirmLabel="Publish"
      onConfirm={async () => {
        const res = await publishRace(id);
        if (res.error) throw new Error(res.error);
      }}
    />
  );
}
