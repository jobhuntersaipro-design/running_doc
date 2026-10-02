import { cookies } from "next/headers";
import { after } from "next/server";
import { safeNext, startSession } from "@/lib/server/auth";
import { welcomeOnce } from "@/lib/server/welcome";

interface IdToken {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** Google sends the runner back here with a code, which is swapped for their verified email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = jar.get("oauth_state")?.value;
  jar.delete({ name: "oauth_state", path: "/api/auth/google" });
  let expected: { state?: string; next?: string } = {};
  try {
    expected = JSON.parse(saved ?? "{}");
  } catch {}
  const fail = () => Response.redirect(new URL("/signin?error=1", url.origin), 302);
  const code = url.searchParams.get("code");
  if (!code || !expected.state || url.searchParams.get("state") !== expected.state) return fail();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Google token exchange failed", res.status, await res.text());
    return fail();
  }
  // The ID token came straight from Google's token endpoint over TLS, so its claims can be
  // read without checking the signature (OpenID Connect Core 3.1.3.7).
  const { id_token } = (await res.json()) as { id_token?: string };
  let claims: IdToken = {};
  try {
    claims = JSON.parse(Buffer.from((id_token ?? "").split(".")[1] ?? "", "base64url").toString());
  } catch {}
  const valid =
    (claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com") &&
    claims.aud === process.env.GOOGLE_CLIENT_ID &&
    (claims.exp ?? 0) * 1000 > Date.now() &&
    claims.email_verified === true &&
    typeof claims.email === "string";
  if (!valid) return fail();

  await startSession({ email: claims.email!, name: claims.name || claims.email! });
  // After the redirect is sent, so sign-in never waits on the email.
  after(() => welcomeOnce(claims.email!, claims.name ?? "", url.origin).catch((e) => console.error("Welcome email failed:", e)));
  return Response.redirect(new URL(safeNext(expected.next ?? null), url.origin), 302);
}
