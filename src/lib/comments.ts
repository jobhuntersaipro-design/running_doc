import type { ThreadComment } from "@/components/arc/comment-thread/comment-thread";

/** Reactions a runner can leave on a comment. The first is the like. */
export const REACTIONS = ["👍", "❤️", "🔥", "👏", "😂"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MAX_COMMENT = 1000;

/** One stored comment, with people as opaque ids so emails never reach the browser. */
export interface CommentRow {
  id: string;
  parentId: string | null;
  authorId: string;
  name: string;
  body: string;
  /** ISO time */
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  /** Who left each reaction, by emoji. */
  reactions: Record<string, string[]>;
}

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

/**
 * Nests comments (oldest first) under the comment they reply to. A reply whose
 * parent is gone moves to the top level; a deleted comment stays only while it
 * still has replies, as a placeholder.
 */
export function toThread(rows: CommentRow[]): ThreadComment[] {
  const nodes = new Map<string, ThreadComment & { replies: ThreadComment[] }>();
  for (const r of rows)
    nodes.set(r.id, {
      id: r.id,
      author: { id: r.authorId, name: r.name || "Runner" },
      body: r.deleted ? "" : r.body,
      createdAt: when.format(new Date(r.createdAt)),
      edited: r.edited || undefined,
      deleted: r.deleted || undefined,
      reactions: REACTIONS.filter((e) => r.reactions[e]?.length).map((emoji) => ({ emoji, users: r.reactions[emoji] })),
      replies: [],
    });
  const top: ThreadComment[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    (parent ? parent.replies : top).push(node);
  }
  const prune = (list: ThreadComment[]): ThreadComment[] =>
    list.flatMap((c) => {
      const replies = prune(c.replies ?? []);
      return c.deleted && replies.length === 0 ? [] : [{ ...c, replies }];
    });
  return prune(top);
}
