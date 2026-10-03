import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sign-in. Runners sign in with Google (see /api/auth/google). The admin can
 * also sign in with a password at /admin. Credentials never live in the code:
 * the server reads ADMIN_EMAIL, ADMIN_PASSWORD_HASH ("scrypt:N:salt:hash",
 * made with scripts/hash-password.mjs), AUTH_SECRET (signs the session cookie)
 * and GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from the environment.
 */

const COOKIE = "session";
const SESSION_DAYS = 7;

function scryptAsync(password: string, salt: Buffer, keylen: number, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, { N, r: 8, p: 1, maxmem: 256 * N * 8 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && process.env.AUTH_SECRET);
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks an email and password against the configured admin. Constant time for the comparisons. */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  if (!adminConfigured()) return false;
  const [scheme, nText, saltB64, hashB64] = (process.env.ADMIN_PASSWORD_HASH ?? "").split(":");
  if (scheme !== "scrypt" || !nText || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, Number(nText));
  const emailOk = safeEqual(
    Buffer.from(email.trim().toLowerCase()),
    Buffer.from((process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()),
  );
  return safeEqual(actual, expected) && emailOk;
}

function sign(payload: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(payload).digest("base64url");
}

export interface SessionUser {
  email: string;
  name: string;
  admin: boolean;
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether this is the admin's email. The admin speaks as Running Doc. */
export const isAdminEmail = (email: string) => adminConfigured() && sameEmail(email, process.env.ADMIN_EMAIL ?? "");

/** Signs the user in for SESSION_DAYS. The admin is whoever has ADMIN_EMAIL, by password or Google. */
export async function startSession(user: { email: string; name: string }): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.email, name: user.name, exp: Date.now() + SESSION_DAYS * 86400_000, n: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, from a valid and unexpired session cookie. */
export async function getUser(): Promise<SessionUser | null> {
  if (!process.env.AUTH_SECRET) return null;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string; name?: string; exp?: number };
    if (typeof data.sub !== "string" || typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    const admin = adminConfigured() && sameEmail(data.sub, process.env.ADMIN_EMAIL ?? "");
    return { email: data.sub, name: data.name || data.sub, admin };
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await getUser())?.admin ?? false;
}

/** A same-site path to return to after sign-in; anything else goes home. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
