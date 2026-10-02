import { isRunnerProfile } from "@/lib/planner";
import { getUser } from "@/lib/server/auth";
import { getProfile, saveProfile } from "@/lib/server/runners";

/** The signed-in runner's profile (age, sex, height, weight, VO2 max). 401 when signed out. */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const profile = await getProfile(user.email).catch((e) => {
    console.error("Reading profile failed:", e);
    return null;
  });
  return Response.json({ profile }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isRunnerProfile(body)) return new Response("Invalid profile", { status: 400 });
  const { age, sex, heightCm, weightKg, vo2max } = body;
  const saved = await saveProfile(user.email, user.name, { age, sex, heightCm, weightKg, vo2max }).catch((e) => {
    console.error("Saving profile failed:", e);
    return false;
  });
  return new Response(null, { status: saved ? 204 : 503 });
}
