import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Single-admin login. Credentials never live in the code: the server reads
 * ADMIN_EMAIL, ADMIN_PASSWORD_HASH ("scrypt:N:salt:hash", made with scripts/hash-password.mjs)
 * and AUTH_SECRET (signs the session cookie) from the environment.
 */

const COOKIE = "admin_session";
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

export async function startSession(): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ sub: process.env.ADMIN_EMAIL, exp: Date.now() + SESSION_DAYS * 86400_000, n: randomBytes(8).toString("hex") }),
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

/** True when the request carries a valid, unexpired admin session. */
export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string; exp?: number };
    return data.sub === process.env.ADMIN_EMAIL && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}
