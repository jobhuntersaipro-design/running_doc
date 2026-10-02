import "server-only";
import { neon } from "@neondatabase/serverless";

/** Neon Postgres over HTTP, when DATABASE_URL is set. */
const url = process.env.DATABASE_URL?.trim();
const sql = url ? neon(url) : null;

// ponytail: the one table is created on first use; add a migration tool once there is a second table.
let ready: Promise<unknown> | null = null;

/** The database, with the runners table in place. A failed setup is retried on the next call. */
function db() {
  if (!sql) return null;
  ready ??= sql`create table if not exists runners (
    email text primary key,
    name text not null default '',
    signed_up_at timestamptz not null default now(),
    last_sign_in_at timestamptz not null default now()
  )`.catch((e) => {
    ready = null;
    throw e;
  });
  return ready.then(() => sql);
}

/** Records a Google sign-in. A runner's first one is their sign-up. */
export async function recordSignIn(email: string, name: string): Promise<void> {
  const q = await db();
  if (!q) return;
  await q`insert into runners (email, name) values (${email.trim().toLowerCase()}, ${name})
    on conflict (email) do update set name = excluded.name, last_sign_in_at = now()`;
}

/** How many runners have signed up, or null without a database. */
export async function countRunners(): Promise<number | null> {
  const q = await db();
  if (!q) return null;
  const [row] = await q`select count(*)::int as n from runners`;
  return row.n as number;
}
