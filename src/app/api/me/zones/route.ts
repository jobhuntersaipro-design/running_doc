import { isZoneSettings } from "@/lib/planner";
import { getUser } from "@/lib/server/auth";
import { listFiles, readText, saveFile, userKey } from "@/lib/server/store";

const keyFor = (email: string) => userKey(email, "zones.json");

/** The signed-in runner's saved heart rate and pace zone settings. 401 when signed out. */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const file = (await listFiles(keyFor(user.email)).catch(() => []))[0];
  const settings = file ? await readText(file.url).then(JSON.parse).catch(() => null) : null;
  return Response.json({ settings: isZoneSettings(settings) ? settings : null }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isZoneSettings(body)) return new Response("Invalid zone settings", { status: 400 });
  const { hr, thresholdPace } = body;
  await saveFile(keyFor(user.email), JSON.stringify({ hr, thresholdPace }), "application/json");
  return new Response(null, { status: 204 });
}
