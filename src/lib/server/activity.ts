import "server-only";
import { db } from "./runners";

/** What a runner (or the admin) did. The admin's activity log is made of these. */
export const EVENT_KINDS = {
  signin: "signed in",
  goal: "saved a goal",
  comment: "commented",
  reply: "replied to a comment",
  comment_edited: "edited a comment",
  comment_deleted: "deleted a comment",
  reaction: "reacted",
  unreaction: "took back a reaction",
  race_liked: "liked a race",
  race_unliked: "took back a like",
  announce: "emailed runners about a race",
  emails_off: "unsubscribed from new race emails",
  emails_on: "turned new race emails back on",
  race_added: "added a race",
  race_edited: "edited a race",
  race_published: "published a race",
  race_unpublished: "made a race private",
  race_deleted: "deleted a race",
  cover: "changed a cover",
} as const;
export type EventKind = keyof typeof EVENT_KINDS;

export interface ActivityEvent {
  id: string;
  /** ISO time */
  at: string;
  email: string;
  kind: EventKind;
  raceId: string | null;
  detail: string;
}

const key = (email: string) => email.trim().toLowerCase();

/** Adds to the activity log. Never throws: a lost log line must not fail what the runner did. */
export async function logEvent(email: string, kind: EventKind, raceId: string | null = null, detail = ""): Promise<void> {
  try {
    const q = await db();
    if (q) await q`insert into events (email, kind, race_id, detail) values (${key(email)}, ${kind}, ${raceId}, ${detail.slice(0, 200)})`;
  } catch (e) {
    console.error("Logging activity failed:", e);
  }
}

/** The newest events, for one runner or one race if given. Null without a database. */
export async function listEvents(filter: { email?: string; raceId?: string } = {}, limit = 300): Promise<ActivityEvent[] | null> {
  const q = await db();
  if (!q) return null;
  const email = filter.email ? key(filter.email) : null;
  const raceId = filter.raceId ?? null;
  const rows = await q`select id, at, email, kind, race_id, detail from events
    where (${email}::text is null or email = ${email}) and (${raceId}::text is null or race_id = ${raceId})
    order by at desc limit ${limit}`;
  return rows.map((r) => ({ id: String(r.id), at: new Date(r.at).toISOString(), email: r.email, kind: r.kind, raceId: r.race_id, detail: r.detail }));
}

export interface AdminComment {
  id: string;
  raceId: string;
  email: string;
  name: string;
  body: string;
  createdAt: string;
  /** Reactions it received, by emoji. */
  counts: Record<string, number>;
}

/**
 * Every comment with its reactions, newest first, and how many reactions each
 * runner has left. Null without a database.
 */
// ponytail: loads every comment; page it once there are tens of thousands.
export async function commentsOverview(): Promise<{ comments: AdminComment[]; reactionsGiven: Record<string, number> } | null> {
  const q = await db();
  if (!q) return null;
  const [rows, given] = await Promise.all([
    q`select c.id, c.race_id, c.email, c.name, c.body, c.created_at,
        coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*)::int as n from comment_reactions where comment_id = c.id group by emoji) x), '{}'::jsonb) as counts
      from comments c where not c.deleted order by c.created_at desc, c.id desc`,
    q`select email, count(*)::int as n from comment_reactions group by email`,
  ]);
  return {
    comments: rows.map((r) => ({
      id: String(r.id),
      raceId: r.race_id,
      email: r.email,
      name: r.name,
      body: r.body,
      createdAt: new Date(r.created_at).toISOString(),
      counts: r.counts,
    })),
    reactionsGiven: Object.fromEntries(given.map((r) => [r.email, r.n])),
  };
}
