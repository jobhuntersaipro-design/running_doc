import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { safeNext } from "@/lib/server/auth";

/** Starts Google sign-in. Sign-up is the same step: a new Google account just signs in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) {
    return new Response("Google sign-in is not set up yet.", { status: 503 });
  }
  const state = randomBytes(16).toString("base64url");
  (await cookies()).set("oauth_state", JSON.stringify({ state, next: safeNext(url.searchParams.get("next")) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return Response.redirect(google, 302);
}
