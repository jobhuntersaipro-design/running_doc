import { logEvent } from "@/lib/server/activity";
import { validUnsubscribe } from "@/lib/server/announce";
import { setRaceEmails } from "@/lib/server/runners";

/** One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("e") ?? "";
  if (!validUnsubscribe(email, url.searchParams.get("t") ?? "")) return new Response("Invalid link", { status: 400 });
  const saved = await setRaceEmails(email, false).catch((e) => {
    console.error("Unsubscribing failed:", e);
    return false;
  });
  if (!saved) return new Response("Try again later", { status: 503 });
  await logEvent(email, "emails_off");
  return new Response(null, { status: 204 });
}

/** Opened in a browser: show the page with its button instead of acting on a GET. */
export function GET(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(new URL(`/unsubscribe${url.search}`, url.origin), 303);
}
