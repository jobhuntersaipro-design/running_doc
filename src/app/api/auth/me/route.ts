import { getUser } from "@/lib/server/auth";

/** Who is signed in, for the site header. */
export async function GET() {
  const user = await getUser();
  return Response.json(user ? { name: user.name, email: user.email, admin: user.admin } : null, { headers: { "cache-control": "no-store" } });
}
