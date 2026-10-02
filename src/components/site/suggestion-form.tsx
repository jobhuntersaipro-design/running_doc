"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Input } from "@/components/arc/input/input";
import inputStyles from "@/components/arc/input/input.module.css";
import { Select } from "@/components/arc/select/select";
import { LIMITS, formatMb } from "@/app/admin/shared";
import { sendSuggestion } from "@/app/suggestion/actions";
import { MAX_IMAGES, SUGGESTION_TYPES, type SuggestionState } from "@/app/suggestion/shared";
import adminStyles from "@/components/admin/admin.module.css";
import styles from "./site.module.css";

export function SuggestionForm() {
  const [state, dispatch, pending] = useActionState<SuggestionState, FormData>(sendSuggestion, {});
  const [type, setType] = useState(SUGGESTION_TYPES[0].value);
  const [images, setImages] = useState<File[]>([]);
  const total = images.reduce((n, f) => n + f.size, 0);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    for (const f of images) fd.append("images", f);
    startTransition(() => dispatch(fd));
  }

  if (state.sent) {
    return (
      <section className={adminStyles.loginCard}>
        <Alert tone="success" title="Thanks, your suggestion was sent">
          Every suggestion is read. If you left your email, you may get a reply.
        </Alert>
        <Link href="/" className={adminStyles.primaryLink}>
          Back to races
        </Link>
      </section>
    );
  }

  return (
    <section className={adminStyles.loginCard} aria-labelledby="suggestion-heading">
      <div className={adminStyles.headText}>
        <h1 id="suggestion-heading" className={adminStyles.title}>
          Suggestion box
        </h1>
        <p className={adminStyles.lede}>
          Help make Running Doc better. Specific suggestions are the easiest to act on: say what you were doing, what happened or
          what you wanted, and why it matters to you.
        </p>
      </div>
      <form className={adminStyles.form} onSubmit={submit}>
        <Select label="Type" options={SUGGESTION_TYPES} value={type} onValueChange={setType} />
        <div className={inputStyles.field}>
          <label className={inputStyles.label} htmlFor="suggestion-text">
            Your suggestion
          </label>
          <textarea id="suggestion-text" name="text" className={`${inputStyles.input} ${styles.textarea}`} rows={6} required minLength={20} maxLength={5000} aria-describedby="suggestion-hint" />
          <span id="suggestion-hint" className={inputStyles.description}>
            {SUGGESTION_TYPES.find((t) => t.value === type)?.hint}
          </span>
        </div>
        <FileDropzone
          label="Screenshots or photos"
          description="Optional. A picture of the bug or the idea helps."
          accept="image/*"
          maxFiles={MAX_IMAGES}
          maxSize={LIMITS.total}
          note={`Up to ${MAX_IMAGES} images, ${formatMb(LIMITS.total)} in total`}
          onFilesChange={setImages}
        />
        {total > LIMITS.total ? (
          <Alert tone="warning" title="These images are too large together">
            They add up to {formatMb(total)}. Remove one or attach smaller images, up to {formatMb(LIMITS.total)} in total.
          </Alert>
        ) : null}
        <Input label="Your email" description="Optional. Add it if you would like a reply." name="email" type="email" autoComplete="email" inputMode="email" />
        {state.error ? (
          <Alert tone="danger" title="Your suggestion was not sent">
            {state.error}
          </Alert>
        ) : null}
        <Button type="submit" loading={pending} disabled={total > LIMITS.total}>
          Send suggestion
        </Button>
      </form>
    </section>
  );
}
