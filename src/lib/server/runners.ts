import "server-only";
import { neon } from "@neondatabase/serverless";
import { isRunnerProfile, type RunnerProfile } from "../planner/runner";

/** Neon Postgres over HTTP, when DATABASE_URL is set. */
const url = process.env.DATABASE_URL?.trim();
const sql = url ? neon(url) : null;

// ponytail: the one table is created and extended on first use; add a migration tool once there is a second table.
let ready: Promise<unknown> | null = null;

/** The database, with the runners table in place. A failed setup is retried on the next call. */
function db() {
  if (!sql) return null;
  ready ??= sql`create table if not exists runners (
    email text primary key,
    name text not null default '',
    signed_up_at timestamptz not null default now(),
    last_sign_in_at timestamptz not null default now()
  )`
    .then(() => sql`alter table runners add column if not exists profile jsonb`)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready.then(() => sql);
}

const key = (email: string) => email.trim().toLowerCase();

/** Records a Google sign-in. A runner's first one is their sign-up. */
export async function recordSignIn(email: string, name: string): Promise<void> {
  const q = await db();
  if (!q) return;
  await q`insert into runners (email, name) values (${key(email)}, ${name})
    on conflict (email) do update set name = excluded.name, last_sign_in_at = now()`;
}

export type Runner = { email: string; name: string; signedUpAt: string };

/** Every runner who has signed up, newest first, or null without a database. */
export async function listRunners(): Promise<Runner[] | null> {
  const q = await db();
  if (!q) return null;
  const rows = await q`select email, name, signed_up_at from runners order by signed_up_at desc`;
  return rows.map((r) => ({ email: r.email, name: r.name, signedUpAt: new Date(r.signed_up_at).toISOString() }));
}

/** A runner's saved profile, or null without a database or before they save one. */
export async function getProfile(email: string): Promise<RunnerProfile | null> {
  const q = await db();
  if (!q) return null;
  const [row] = await q`select profile from runners where email = ${key(email)}`;
  return isRunnerProfile(row?.profile) ? row.profile : null;
}

/** Saves a runner's profile. Resolves false without a database. */
export async function saveProfile(email: string, name: string, profile: RunnerProfile): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  await q`insert into runners (email, name, profile) values (${key(email)}, ${name}, ${JSON.stringify(profile)}::jsonb)
    on conflict (email) do update set profile = excluded.profile`;
  return true;
}
