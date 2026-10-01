"use client";

import { useRouter } from "next/navigation";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { deleteRace } from "@/app/admin/actions";

export function DeleteRace({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmMorph
      label="Delete"
      tone="danger"
      prompt={`Delete ${name}?`}
      confirmLabel="Delete"
      onConfirm={async () => {
        const res = await deleteRace(id);
        if (res.error) throw new Error(res.error);
        router.refresh();
      }}
    />
  );
}
