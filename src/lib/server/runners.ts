import "server-only";
import { neon } from "@neondatabase/serverless";
import { isRunnerProfile, isSavedGoal, type RunnerProfile, type SavedGoal } from "../planner/runner";

/** Neon Postgres over HTTP, when DATABASE_URL is set. */
const url = process.env.DATABASE_URL?.trim();
const sql = url ? neon(url) : null;

// ponytail: tables are created and extended on first use; add a migration tool once a change needs more than "if not exists".
let ready: Promise<unknown> | null = null;

/** The database, with its tables in place. A failed setup is retried on the next call. */
export function db() {
  if (!sql) return null;
  ready ??= sql`create table if not exists runners (
    email text primary key,
    name text not null default '',
    signed_up_at timestamptz not null default now(),
    last_sign_in_at timestamptz not null default now()
  )`
    .then(() => sql`alter table runners add column if not exists profile jsonb`)
    .then(() => sql`alter table runners add column if not exists goals jsonb not null default '{}'::jsonb`)
    .then(() => sql`create table if not exists comments (
      id bigserial primary key,
      race_id text not null,
      email text not null,
      name text not null,
      body text not null,
      created_at timestamptz not null default now()
    )`)
    .then(() => sql`create index if not exists comments_race on comments (race_id, created_at)`)
    .then(() => sql`create table if not exists comment_reactions (
      comment_id bigint not null references comments (id) on delete cascade,
      email text not null,
      emoji text not null,
      primary key (comment_id, email, emoji)
    )`)
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

export type Runner = {
  email: string;
  name: string;
  signedUpAt: string;
  lastSignInAt: string;
  profile: RunnerProfile | null;
  goals: Record<string, SavedGoal>;
};

/** Every runner who has signed up, newest first, or null without a database. */
export async function listRunners(): Promise<Runner[] | null> {
  const q = await db();
  if (!q) return null;
  const rows = await q`select email, name, signed_up_at, last_sign_in_at, profile, goals from runners order by signed_up_at desc`;
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    signedUpAt: new Date(r.signed_up_at).toISOString(),
    lastSignInAt: new Date(r.last_sign_in_at).toISOString(),
    profile: isRunnerProfile(r.profile) ? r.profile : null,
    goals: Object.fromEntries(Object.entries((r.goals ?? {}) as Record<string, unknown>).filter((e): e is [string, SavedGoal] => isSavedGoal(e[1]))),
  }));
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

/** A runner's saved goals by race id. Empty without a database. */
export async function getGoals(email: string): Promise<Record<string, SavedGoal>> {
  const q = await db();
  if (!q) return {};
  const [row] = await q`select goals from runners where email = ${key(email)}`;
  return Object.fromEntries(Object.entries((row?.goals ?? {}) as Record<string, unknown>).filter((e): e is [string, SavedGoal] => isSavedGoal(e[1])));
}

/** Saves or replaces a runner's goal for one race. Resolves false without a database. */
export async function saveGoal(email: string, name: string, raceId: string, goal: SavedGoal): Promise<boolean> {
  const q = await db();
  if (!q) return false;
  await q`insert into runners (email, name, goals) values (${key(email)}, ${name}, jsonb_build_object(${raceId}::text, ${JSON.stringify(goal)}::jsonb))
    on conflict (email) do update set goals = runners.goals || excluded.goals`;
  return true;
}
