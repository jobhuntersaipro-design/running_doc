"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import inputStyles from "@/components/arc/input/input.module.css";
import { postComment, reactToComment, removeComment, type CommentState } from "@/app/races/[id]/actions";
import { MAX_COMMENT, REACTIONS, type RaceComment } from "@/lib/comments";
import siteStyles from "@/components/site/site.module.css";
import styles from "./planner.module.css";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Comments on a race, with likes and reactions. `comments` is null when there is no database. */
export function RaceComments({ raceId, comments, signedIn }: { raceId: string; comments: RaceComment[] | null; signedIn: boolean }) {
  const [state, post, posting] = useActionState<CommentState, FormData>(postComment.bind(null, raceId), {});
  const [busy, startTransition] = useTransition();
  if (!comments) return null;

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className={styles.h2}>
        Comments {comments.length ? <span className={styles.muted}>({comments.length})</span> : null}
      </h2>
      {comments.length === 0 ? <p className={styles.muted}>No comments yet. Ask about the course or share a tip.</p> : null}
      <ul className={styles.comments}>
        {comments.map((c) => (
          <li key={c.id} className={styles.comment}>
            <p className={styles.commentHead}>
              <strong>{c.name}</strong>{" "}
              <time dateTime={c.createdAt} className={styles.muted} suppressHydrationWarning>
                {when(c.createdAt)}
              </time>
            </p>
            <p className={styles.commentBody}>{c.body}</p>
            <div className={styles.reactions}>
              {REACTIONS.map((emoji) => {
                const n = c.counts[emoji] ?? 0;
                const mine = c.mine.includes(emoji);
                if (!signedIn && !n) return null;
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.reaction}
                    aria-pressed={mine}
                    aria-label={`${emoji === "👍" ? "Like" : `React ${emoji}`}${n ? `, ${n}` : ""}`}
                    disabled={!signedIn || busy}
                    onClick={() => startTransition(() => reactToComment(raceId, c.id, emoji))}
                  >
                    {emoji}
                    {n ? <span className={styles.num}>{n}</span> : null}
                  </button>
                );
              })}
              {c.canDelete ? (
                <button
                  type="button"
                  className={styles.reaction}
                  aria-label="Delete comment"
                  disabled={busy}
                  onClick={() => confirm("Delete this comment?") && startTransition(() => removeComment(raceId, c.id))}
                >
                  <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {signedIn ? (
        <form action={post} key={state.posted} className={styles.commentForm}>
          <label className={inputStyles.label} htmlFor="comment-body">
            Add a comment
          </label>
          <textarea id="comment-body" name="body" className={`${inputStyles.input} ${siteStyles.textarea}`} rows={3} required maxLength={MAX_COMMENT} />
          {state.error ? (
            <Alert tone="danger" title="Not posted">
              {state.error}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" size="sm" loading={posting}>
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.muted}>
          <Link href={`/signin?next=${encodeURIComponent(`/races/${raceId}`)}`}>Sign in</Link> to comment and react.
        </p>
      )}
    </section>
  );
}
