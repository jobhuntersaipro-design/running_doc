import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { esc, FONT, sendBatch, type Email } from "./email";
import { logEvent } from "./activity";
import { raceEmailRecipients } from "./runners";

/** What the email says about the race. */
export interface AnnouncedRace {
  id: string;
  event: string;
  category: string;
  officialKm: number;
  dateLabel: string;
  startTime?: string;
  location: string;
  officialUrl: string;
  /** Who published it: the runner's name, or Running Doc for the admin's races. */
  publishedBy: string;
}

const key = (email: string) => email.trim().toLowerCase();

/** Signs an unsubscribe link, so only the runner's own emails can turn their emails off. */
export const unsubscribeToken = (email: string) =>
  createHmac("sha256", process.env.AUTH_SECRET || "running-doc").update(`race-emails:${key(email)}`).digest("base64url").slice(0, 32);

export function validUnsubscribe(email: string, token: string): boolean {
  const want = Buffer.from(unsubscribeToken(email));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

const query = (email: string) => `e=${encodeURIComponent(key(email))}&t=${unsubscribeToken(email)}`;

function startLabel(hhmm?: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `, ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"} start`;
}

const FOOTER = "You are getting this because you have a Running Doc account. Plans are general guidance, not medical or coaching advice.";

// Lets mail apps offer their own one-click unsubscribe (RFC 8058).
const unsubscribeHeaders = (site: string, email: string) => ({
  "List-Unsubscribe": `<${site}/api/unsubscribe?${query(email)}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

const firstName = (name: string) => (name.includes("@") ? "" : (name.trim().split(/\s+/)[0] ?? ""));

/** The page around every race email: logo header, white card holding `body`, unsubscribe footer. */
function shell(site: string, title: string, preheader: string, body: string, unsubscribe: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f8;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f5f8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 8px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:10px;"><img src="${site}/apple-icon.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="${FONT}font-size:17px;font-weight:600;color:#16324f;">Running Doc</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e1e6ec;border-radius:16px;padding:28px 20px;${FONT}color:#1d2127;">
${body}</td></tr>
<tr><td style="padding:22px 8px 0;${FONT}font-size:12px;line-height:1.6;color:#868d97;">
<p style="margin:0 0 8px;">Do not want emails about new races? <a href="${unsubscribe}" style="color:#868d97;">Unsubscribe</a></p>
<p style="margin:0;">${FOOTER}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** The email telling one runner about a newly published race. `site` is the origin links point to. */
export function raceEmail(race: AnnouncedRace, to: { email: string; name: string }, site: string): Email {
  const link = `${site}/races/${encodeURIComponent(race.id)}`;
  const unsubscribe = `${site}/unsubscribe?${query(to.email)}`;
  const first = firstName(to.name);
  const what = `${race.category}, ${race.officialKm.toFixed(1)} km`;
  const when = `${race.dateLabel}${startLabel(race.startTime)}`;
  const intro = `${race.publishedBy} just published ${race.event} on Running Doc. Open it for a pace plan for every kilometre, the hills, gels and water, and a rehearsal of the course.`;
  const rows = [
    ["What", what],
    ["When", when],
    ["Where", race.location],
  ]
    .map(
      ([k, v]) =>
        `<tr><td width="72" valign="top" style="padding:0 0 10px;font-size:14px;color:#868d97;">${k}</td><td valign="top" style="padding:0 0 10px;font-size:15px;color:#1d2127;">${esc(v)}</td></tr>`,
    )
    .join("");

  const html = shell(site, race.event, `${what}. ${when}, ${race.location}.`, `<p style="margin:0 0 6px;font-size:14px;color:#4f5763;">${esc(first ? `Hi ${first}, a new race is up.` : "A new race is up.")}</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;font-weight:700;color:#16324f;">${esc(race.event)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4f5763;">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows}</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
<td style="border-radius:10px;background:#1f7dcf;"><a href="${link}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Open the race plan</a></td>
</tr></table>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4f5763;"><a href="${esc(race.officialUrl)}" style="color:#1f7dcf;font-weight:600;text-decoration:none;">Official race website</a></p>
`, unsubscribe);

  const text = [
    first ? `Hi ${first}, a new race is up.` : "A new race is up.",
    race.event,
    intro,
    `What: ${what}\nWhen: ${when}\nWhere: ${race.location}`,
    `Open the race plan: ${link}`,
    `Official race website: ${race.officialUrl}`,
    `Do not want emails about new races? Unsubscribe: ${unsubscribe}`,
    FOOTER,
  ].join("\n\n");

  return {
    to: to.email,
    subject: `New race: ${race.event}, ${race.category}`,
    html,
    text,
    headers: unsubscribeHeaders(site, to.email),
  };
}

/**
 * Emails every runner who has not unsubscribed about a newly published race,
 * leaving out `except` (the publisher and the race's runner). Logged under `by`.
 */
export async function announceRace(race: AnnouncedRace, site: string, by: string, except: string[]): Promise<number> {
  const recipients = await raceEmailRecipients(except);
  const sent = await sendBatch(recipients.map((to) => raceEmail(race, to, site)));
  await logEvent(by, "announce", race.id, `${sent} of ${recipients.length} runners`);
  return sent;
}

/** One event in the digest: a race and every distance it offers. */
export interface DigestRace {
  id: string;
  event: string;
  dateLabel: string;
  location: string;
  officialUrl: string;
  /** Short names, shortest first: ["5K", "10K", "21K"]. */
  distances: string[];
}

// Buttons are table cells with a background (bgcolor too, for Outlook), so they render as buttons, not links.
const button = (href: string, label: string, primary: boolean) =>
  `<td bgcolor="${primary ? "#1f7dcf" : "#ffffff"}" style="border-radius:10px;background:${primary ? "#1f7dcf" : "#ffffff"};${primary ? "" : "border:1px solid #c9d3de;"}"><a href="${esc(href)}" style="display:inline-block;padding:11px 16px;${FONT}font-size:14px;font-weight:600;white-space:nowrap;color:${primary ? "#ffffff" : "#16324f"};text-decoration:none;border-radius:10px;">${label}</a></td>`;

export const digestSubject = (races: DigestRace[]) =>
  races.length === 1 ? `Upcoming race: ${races[0].event}` : `${races.length} upcoming races: ${races[0].event} + ${races.length - 1} more`;

/** The digest email for one runner: up to three upcoming races, one card each. */
export function digestEmail(races: DigestRace[], to: { email: string; name: string }, site: string): Email {
  const unsubscribe = `${site}/unsubscribe?${query(to.email)}`;
  const first = firstName(to.name);
  const greeting = `${first ? `Hi ${first}, here` : "Here"} ${races.length === 1 ? "is the next race" : `are the next ${races.length} races`} on the calendar.`;
  const plan = (r: DigestRace) => `${site}/races/${encodeURIComponent(r.id)}`;
  const cards = races
    .map(
      (r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border:1px solid #e1e6ec;border-radius:12px;">
<tr><td style="padding:16px 16px 16px;">
<p style="margin:0 0 4px;font-size:13px;color:#868d97;">${esc(r.dateLabel)}</p>
<h2 style="margin:0 0 6px;font-size:18px;line-height:1.35;font-weight:700;color:#16324f;">${esc(r.event)}</h2>
<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#4f5763;">${esc(r.location)}<br><strong style="color:#1d2127;">${esc(r.distances.join(" · "))}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${button(plan(r), "Open race plan", true)}<td width="10"></td>${button(r.officialUrl, "Official site", false)}</tr></table>
</td></tr></table>`,
    )
    .join("\n");
  const body = `<p style="margin:0 0 6px;font-size:14px;color:#4f5763;">${esc(greeting)}</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:#16324f;">${races.length === 1 ? "Upcoming race" : `${races.length} upcoming races`}</h1>
${cards}
<p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#4f5763;">Each plan has your pace for every kilometre, the hills, gels and water, and a rehearsal of the course.</p>
`;
  const text = [
    greeting,
    ...races.map((r) => `${r.event}\n${r.dateLabel}\n${r.location}\n${r.distances.join(" · ")}\nRace plan: ${plan(r)}\nOfficial site: ${r.officialUrl}`),
    `Do not want emails about new races? Unsubscribe: ${unsubscribe}`,
    FOOTER,
  ].join("\n\n");
  const subject = digestSubject(races);
  return { to: to.email, subject, html: shell(site, subject, races.map((r) => r.event).join(", "), body, unsubscribe), text, headers: unsubscribeHeaders(site, to.email) };
}

/** Emails the digest to every runner who has not unsubscribed. Resolves to how many emails Resend accepted, of how many runners. */
export async function sendDigest(races: DigestRace[], site: string, by: string): Promise<{ sent: number; runners: number }> {
  const recipients = await raceEmailRecipients([]);
  const sent = await sendBatch(recipients.map((to) => digestEmail(races, to, site)));
  await logEvent(by, "digest", null, `${sent} of ${recipients.length} runners: ${races.map((r) => r.id).join(", ")}`);
  return { sent, runners: recipients.length };
}
