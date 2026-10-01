"use client";

import { startTransition, useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { saveCover } from "@/app/admin/actions";
import { LIMITS, formatMb, type FormState } from "@/app/admin/shared";
import styles from "./admin.module.css";

/** Cover image for a built-in race. Its other details live in the code. */
export function CoverForm({ id, name, coverUrl }: { id: string; name: string; coverUrl?: string }) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(saveCover, {});
  const [cover, setCover] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", id);
    if (cover) fd.set("cover", cover);
    if (remove) fd.set("removeCover", "on");
    startTransition(() => dispatch(fd));
  }

  const shown = preview ?? (remove ? null : coverUrl);
  return (
    <form className={styles.raceForm} onSubmit={submit} noValidate>
      <div className={styles.headText}>
        <h1 className={styles.title}>Cover for {name}</h1>
        <p className={styles.lede}>This race is built into the app, so only its cover can change here.</p>
      </div>
      <div className={styles.coverGrid}>
        <div className={styles.coverPreview} aria-label="Cover preview">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" />
          ) : (
            <span className={styles.muted}>No cover. The card shows the route map instead.</span>
          )}
        </div>
        <div className={styles.fileField}>
          <FileDropzone
            label={coverUrl ? "Replace cover image" : "Cover image"}
            description="Shown at the top of the race card. A wide photo works best (16:9)."
            accept="image/jpeg,image/png,image/webp"
            multiple={false}
            maxFiles={1}
            maxSize={LIMITS.cover}
            note={`JPG, PNG or WebP, up to ${formatMb(LIMITS.cover)}`}
            onFilesChange={(f) => setCover(f[0] ?? null)}
          />
          {coverUrl && !cover ? <Checkbox label="Remove the current cover" checked={remove} onCheckedChange={(v) => setRemove(v === true)} /> : null}
        </div>
      </div>
      {state.error ? (
        <Alert tone="danger" title="The cover was not saved">
          {state.error}
        </Alert>
      ) : null}
      <div className={styles.formActions}>
        <Button type="submit" loading={pending} disabled={!cover && !remove}>
          Save cover
        </Button>
      </div>
    </form>
  );
}
