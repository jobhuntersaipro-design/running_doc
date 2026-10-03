import "server-only";
import type { RaceComment, Reaction } from "../comments";
import { db } from "./runners";

const key = (email: string) => email.trim().toLowerCase();

/** A race's comments, oldest first, with reaction counts. Null without a database. */
export async function listComments(raceId: string, viewer: { email: string; admin: boolean } | null): Promise<RaceComment[] | null> {
  const q = await db();
  if (!q) return null;
  const me = viewer ? key(viewer.email) : "";
  const rows = await q`select c.id, c.name, c.body, c.created_at, c.email = ${me} as own,
      coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*)::int as n from comment_reactions where comment_id = c.id group by emoji) x), '{}'::jsonb) as counts,
      coalesce((select jsonb_agg(emoji) from comment_reactions where comment_id = c.id and email = ${me}), '[]'::jsonb) as mine
    from comments c where c.race_id = ${raceId} order by c.created_at, c.id`;
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
    counts: r.counts,
    mine: r.mine,
    canDelete: Boolean(r.own) || Boolean(viewer?.admin),
  }));
}

/** Adds a comment. Resolves false without a database. */
export async function addComment(raceId: string, email: string, name: string, body: string): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  await q`insert into comments (race_id, email, name, body) values (${raceId}, ${key(email)}, ${name}, ${body})`;
  return true;
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
      where id = ${commentId}::bigint and race_id = ${raceId} and not exists (select 1 from gone)
      returning 1
    )
    select count(*)::int as n from added`;
  return row?.n > 0;
}

/** Deletes a comment on this race, if the runner wrote it or is the admin. Its reactions go with it. Resolves to what was deleted. */
export async function deleteComment(raceId: string, commentId: string, viewer: { email: string; admin: boolean }): Promise<{ email: string; body: string } | null> {
  const q = await db();
  if (!q) return null;
  const gone = await q`delete from comments where id = ${commentId}::bigint and race_id = ${raceId} and (${viewer.admin} or email = ${key(viewer.email)})
    returning email, body`;
  return gone[0] ? { email: gone[0].email, body: gone[0].body } : null;
}
