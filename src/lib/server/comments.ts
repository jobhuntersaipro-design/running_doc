import "server-only";
import { createHmac } from "node:crypto";
import type { ThreadComment } from "@/components/arc/comment-thread/comment-thread";
import { toThread, type Reaction } from "../comments";
import { db } from "./runners";

const key = (email: string) => email.trim().toLowerCase();

/** A stable id for a runner that the browser can see in place of their email. */
export const personId = (email: string) =>
  createHmac("sha256", process.env.AUTH_SECRET || "running-doc").update(key(email)).digest("base64url").slice(0, 16);

/** A race's comments as a thread, oldest first, with who reacted. Null without a database. */
export async function listComments(raceId: string): Promise<ThreadComment[] | null> {
  const q = await db();
  if (!q) return null;
  const rows = await q`select c.id, c.parent_id, c.email, c.name, c.body, c.created_at, c.edited, c.deleted,
      coalesce((select jsonb_object_agg(emoji, emails) from (select emoji, jsonb_agg(email) as emails from comment_reactions where comment_id = c.id group by emoji) x), '{}'::jsonb) as reactions
    from comments c where c.race_id = ${raceId} order by c.created_at, c.id`;
  return toThread(
    rows.map((r) => ({
      id: String(r.id),
      parentId: r.parent_id === null ? null : String(r.parent_id),
      authorId: personId(r.email),
      name: r.name,
      body: r.body,
      createdAt: new Date(r.created_at).toISOString(),
      edited: r.edited,
      deleted: r.deleted,
      reactions: Object.fromEntries(Object.entries(r.reactions as Record<string, string[]>).map(([emoji, emails]) => [emoji, emails.map(personId)])),
    })),
  );
}

/** Adds a comment, as a reply when parentId names a comment on this race. Resolves false without a database. */
export async function addComment(raceId: string, email: string, name: string, body: string, parentId: string | null = null): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  await q`insert into comments (race_id, email, name, body, parent_id)
    values (${raceId}, ${key(email)}, ${name}, ${body},
      (select id from comments where id = ${parentId}::bigint and race_id = ${raceId} and not deleted))`;
  return true;
}

/** Changes the text of the runner's own comment. Resolves true when it was theirs to change. */
export async function editComment(raceId: string, commentId: string, email: string, body: string): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  const rows = await q`update comments set body = ${body}, edited = true
    where id = ${commentId}::bigint and race_id = ${raceId} and email = ${key(email)} and not deleted returning id`;
  return rows.length > 0;
}

/** Adds the runner's reaction to a comment on this race, or takes it back if they already left it. Resolves true when added. */
export async function toggleReaction(raceId: string, commentId: string, email: string, emoji: Reaction): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  const [row] = await q`with gone as (
      delete from comment_reactions where comment_id = ${commentId}::bigint and email = ${key(email)} and emoji = ${emoji} returning 1
    ), added as (
      insert into comment_reactions (comment_id, email, emoji)
      select id, ${key(email)}, ${emoji} from comments
      where id = ${commentId}::bigint and race_id = ${raceId} and not deleted and not exists (select 1 from gone)
      returning 1
    )
    select count(*)::int as n from added`;
  return row?.n > 0;
}

/**
 * Deletes a comment on this race, if the runner wrote it or is the admin. One
 * with replies stays as an empty placeholder so the replies keep their place.
 * Resolves to what was deleted.
 */
export async function deleteComment(raceId: string, commentId: string, viewer: { email: string; admin: boolean }): Promise<{ email: string; body: string } | null> {
  const q = await db();
  if (!q) return null;
  const [target] = await q`select email, body, parent_id, exists (select 1 from comments r where r.parent_id = c.id) as has_replies
    from comments c where id = ${commentId}::bigint and race_id = ${raceId} and not deleted and (${viewer.admin} or email = ${key(viewer.email)})`;
  if (!target) return null;
  if (target.has_replies) await q`update comments set deleted = true, body = '' where id = ${commentId}::bigint`;
  else {
    await q`delete from comments where id = ${commentId}::bigint`;
    // A placeholder whose last reply just went has nothing left to hold.
    if (target.parent_id !== null)
      await q`delete from comments p where p.id = ${target.parent_id} and p.deleted and not exists (select 1 from comments r where r.parent_id = p.id)`;
  }
  return { email: target.email, body: target.body };
}
