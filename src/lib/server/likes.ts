import "server-only";
import { db } from "./runners";

export interface Likes {
  count: number;
  /** The viewer liked it. */
  mine: boolean;
}

const key = (email: string) => email.trim().toLowerCase();

/** Likes per event key (see eventKey), and whether the viewer gave one. Empty without a database. */
export async function likeCounts(viewerEmail?: string): Promise<Record<string, Likes>> {
  const q = await db();
  if (!q) return {};
  const me = viewerEmail ? key(viewerEmail) : "";
  const rows = await q`select event_key, count(*)::int as n, bool_or(email = ${me}) as mine from race_likes group by event_key`;
  return Object.fromEntries(rows.map((r) => [r.event_key, { count: r.n, mine: r.mine }]));
}

/** Likes an event for the runner, or takes the like back. Resolves true when liked, null without a database. */
export async function toggleLike(eventKey: string, email: string): Promise<boolean | null> {
  const q = await db();
  if (!q) return null;
  const [row] = await q`with gone as (
      delete from race_likes where event_key = ${eventKey} and email = ${key(email)} returning 1
    ), added as (
      insert into race_likes (event_key, email) select ${eventKey}, ${key(email)} where not exists (select 1 from gone) returning 1
    )
    select count(*)::int as n from added`;
  return row?.n > 0;
}
