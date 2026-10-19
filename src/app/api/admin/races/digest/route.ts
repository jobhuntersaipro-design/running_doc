import { shortDistance } from "@/lib/courses/distance";
import { sendDigest, type DigestRace } from "@/lib/server/announce";
import { apiAuthError } from "@/lib/server/auth";
import { emailReady } from "@/lib/server/email";
import { API_ACTOR, apiFailure } from "@/lib/server/race-input";
import { overviewRaces, type RaceCard } from "@/lib/server/races";
import { listFiles, readText, saveFile } from "@/lib/server/store";

const LAST = "digest/last.json";

/**
 * Emails every opted-in runner one digest of the three nearest upcoming races, once a
 * batch of POSTs is done. Sending the same three races again is refused (409), so a
 * repeated call does not email runners twice.
 * ponytail: two calls at the same moment can both send; the bot calls it once per batch.
 */
export async function POST(req: Request) {
  const denied = apiAuthError(req);
  if (denied) return denied;
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  if (!emailReady() || !from || from.includes("onboarding@resend.dev")) {
    console.error("Race digest not sent: set RESEND_API_KEY and EMAIL_FROM to a sender on a verified domain.");
    return Response.json({ error: "Email is not set up: RESEND_API_KEY and EMAIL_FROM on a verified domain are needed." }, { status: 503 });
  }
  try {
    // Race days are local to Malaysia and Singapore, so "today" is too.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
    // One card per event and day, listing its distances. The overview's own grouping
    // would also merge next year's edition of the same event, so group by date too.
    const events = new Map<string, RaceCard[]>();
    for (const r of await overviewRaces(null)) {
      if (!r.date || r.date < today) continue;
      const key = `${r.date}|${r.event.trim().toLowerCase()}`;
      events.set(key, [...(events.get(key) ?? []), r]);
    }
    const races: DigestRace[] = [...events.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([, list]) => {
        const sorted = list.sort((a, b) => a.km - b.km);
        const main = sorted.find((r) => r.coverUrl) ?? sorted[sorted.length - 1];
        return {
          id: main.id,
          event: main.event,
          dateLabel: main.dateLabel,
          location: main.location,
          officialUrl: main.officialUrl,
          distances: [...new Set(sorted.map((r) => shortDistance(r.km)))],
        };
      });
    if (!races.length) return Response.json({ sent: 0, runners: 0, races: [] });

    const key = races.map((r) => r.id).join(",");
    const last = (await listFiles(LAST))[0];
    const previous = last ? await readText(last.url).then((t) => JSON.parse(t) as { key: string; sentAt: number }) : null;
    if (previous?.key === key)
      return Response.json({ error: "These races were already sent", races: races.map((r) => r.id), sentAt: previous.sentAt }, { status: 409 });

    const result = await sendDigest(races, new URL(req.url).origin, API_ACTOR);
    if (result.sent) await saveFile(LAST, JSON.stringify({ key, sentAt: Date.now() }), "application/json");
    return Response.json({ ...result, races: races.map((r) => r.id) });
  } catch (e) {
    return apiFailure(e);
  }
}
