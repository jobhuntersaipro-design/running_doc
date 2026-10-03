"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { CommentThread, type CommentAuthor, type CommentThreadEvent, type ThreadComment } from "@/components/arc/comment-thread/comment-thread";
import { changeComment, postComment, reactToComment, removeComment } from "@/app/races/[id]/actions";
import { REACTIONS, type Reaction } from "@/lib/comments";
import styles from "./planner.module.css";

const GUEST: CommentAuthor = { id: "guest", name: "You" };

/**
 * Comments on a race as a thread: replies, reactions, and editing or deleting
 * your own. Each change shows at once and is then saved; the server's copy
 * replaces it when the save returns. `comments` is null when there is no database.
 */
export function RaceComments({ raceId, comments, me }: { raceId: string; comments: ThreadComment[] | null; me: CommentAuthor | null }) {
  const router = useRouter();
  const [shown, show] = useOptimistic(comments ?? []);
  const [error, setError] = useState<string>();
  if (!comments) return null;
  const signIn = `/signin?next=${encodeURIComponent(`/races/${raceId}`)}`;

  function save(event: CommentThreadEvent) {
    switch (event.type) {
      case "reply":
        return postComment(raceId, event.comment.body, event.parentId);
      case "edit":
        return changeComment(raceId, event.id, event.body);
      case "delete":
        return removeComment(raceId, event.id);
      case "react":
        return reactToComment(raceId, event.id, event.emoji as Reaction);
    }
  }

  function change(next: ThreadComment[], event: CommentThreadEvent) {
    if (!me) return router.push(signIn);
    setError(undefined);
    startTransition(async () => {
      show(next);
      const res = await save(event);
      if (res.error) setError(res.error);
    });
  }

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className={styles.h2}>
        Comments
      </h2>
      <CommentThread
        className={styles.thread}
        comments={shown}
        onCommentsChange={change}
        currentUser={me ?? GUEST}
        reactions={[...REACTIONS]}
        placeholder={me ? "Ask about the course or share a tip" : "Sign in to comment"}
        nowLabel="now"
        labels={{ thread: "Race comments", empty: "No comments yet. Ask about the course or share a tip." }}
      />
      {error ? (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      ) : null}
      {me ? null : (
        <p className={styles.muted}>
          <Link href={signIn}>Sign in</Link> to comment, reply and react.
        </p>
      )}
    </section>
  );
}
